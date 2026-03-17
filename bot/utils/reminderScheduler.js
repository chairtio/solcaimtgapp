// utils/reminderScheduler.js
import { redis } from '../private/private.js';
import Bottleneck from 'bottleneck';
import pTimeout from './pTimeout.js';
import { markUserBotBlocked } from '../lib/supabase-bot.js';

// Create a Bottleneck limiter with a maximum of 30 messages per minute
const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 2000 // 1 minute / 30 messages = 2000 ms
});

// Helper function to send reminder messages with rate limiting
const sendReminderMessage = async (bot, userId) => {
    const channelId = '@SolClaimPortal';
    const messageId = 222;

    try {
        // Check if the key exists in Redis
        const userExists = await pTimeout(redis.exists(`userCreationTime:${userId}`), 10000); // 10 seconds timeout

        if (userExists) {
            try {
                // Send the reminder message using the rate limiter
                await limiter.schedule(() => bot.telegram.forwardMessage(userId, channelId, messageId));
                console.log(`Reminder sent to user ${userId}`);
                
                // Delete the Redis key immediately after sending the reminder
                await pTimeout(redis.del(`userCreationTime:${userId}`), 10000);
                console.log(`Deleted Redis key for user ${userId}`);
            } catch (sendError) {
                // Handle specific errors during message sending
                if (sendError.response && sendError.response.error_code === 403) {
                    console.warn(`User ID ${userId} has blocked the bot or has privacy settings preventing messages.`);
                    markUserBotBlocked(userId).catch((e) => console.error('[markUserBotBlocked]', e.message));
                } else {
                    console.error(`Failed to forward message to user ID ${userId}: ${sendError.message}`);
                }

                // Ensure Redis key is deleted if sending fails, as it might be stale
                try {
                    await pTimeout(redis.del(`userCreationTime:${userId}`), 10000);
                    console.log(`Deleted Redis key for user ${userId}`);
                } catch (delError) {
                    console.error(`Failed to delete Redis key for user ${userId}: ${delError.message}`);
                }
            }
        } else {
            console.log(`User ${userId} no longer exists in Redis.`);
        }
    } catch (error) {
        console.error('Failed to send reminder message:', error.message);
    }
};

// Function to check and send reminders for users who haven't completed actions within an hour
const checkAndSendReminders = async (bot) => {
    try {
        const allUserKeys = await pTimeout(redis.keys('userCreationTime:*'), 10000); // Get all userCreationTime keys

        for (const key of allUserKeys) {
            const userId = key.split(':')[1];
            const creationTime = await pTimeout(redis.get(key), 10000); // Get the creation time

            if (creationTime) {
                const currentTime = Date.now();
                const timeElapsed = currentTime - parseInt(creationTime, 10);

                if (timeElapsed >= 3600000) { // 1 hour = 3600000 ms
                    await sendReminderMessage(bot, userId);
                }
            }
        }
    } catch (error) {
        console.error('Error checking and sending reminders:', error.message);
    }
};

// Schedule reminder checks every 15 minutes
export const scheduleReminderChecks = (bot) => {
    setInterval(async () => {
        try {
            await checkAndSendReminders(bot);
        } catch (error) {
            console.error('Error in reminder check schedule:', error.message);
        }
    }, 900000); // 15 minutes = 900000 ms
};
