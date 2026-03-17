// utils/forwardMessagesToUsers.js
import { userIds } from "./telegramIds.js";
import { markUserBotBlocked } from "../lib/supabase-bot.js";

const RATE_LIMIT_PER_SECOND = 25; // Global limit of 30 messages per second
const WAIT_TIME_MS = 1000 / RATE_LIMIT_PER_SECOND;

const BATCH_SIZE = 100; // Number of users to process in each batch
const DELAY_BETWEEN_BATCHES_MS = 60000; // 1 minute delay between batches to avoid overload

export const forwardMessagesToUsers = async (bot) => {
    const channelId = '@solclaim';
    const messageId = 499;
    try {
        let lastSentTime = Date.now();

        for (let start = 0; start < userIds.length; start += BATCH_SIZE) {
            const batch = userIds.slice(start, start + BATCH_SIZE);

            for (let i = 0; i < batch.length; i++) {
                const userId = batch[i];
                const currentTime = Date.now();

                // Rate limiting
                const elapsedTime = currentTime - lastSentTime;
                if (elapsedTime < WAIT_TIME_MS) {
                    await new Promise(resolve => setTimeout(resolve, WAIT_TIME_MS - elapsedTime));
                }

                try {
                    await bot.telegram.forwardMessage(userId, channelId, messageId);
                    console.log(`Message forwarded to user ID: ${userId}`);
                } catch (sendError) {
                    if (sendError.response) {
                        if (sendError.response.error_code === 403) {
                            console.warn(`User ID ${userId} has blocked the bot or has privacy settings preventing messages.`);
                            markUserBotBlocked(userId).catch((e) => console.error('[markUserBotBlocked]', e.message));
                        } else if (sendError.response.error_code === 429) {
                            const retryAfter = sendError.response.parameters.retry_after;
                            console.warn(`Rate limit exceeded. Retrying after ${retryAfter} seconds.`);
                            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                            i--; // Retry the same user after waiting
                        } else {
                            console.error(`Failed to forward message to user ID ${userId}: ${sendError.message}`);
                        }
                    } else {
                        console.error(`Failed to forward message to user ID ${userId}: ${sendError.message}`);
                    }
                }

                lastSentTime = Date.now(); // Update last sent time
            }

            console.log('Finished processing a batch of users.');
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS)); // Delay between batches

        }

        console.log('Finished forwarding messages to all users.');

    } catch (error) {
        console.error('Error for forward message to users', error.message);
    }
};
