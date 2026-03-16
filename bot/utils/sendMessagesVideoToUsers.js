import { userIds } from "./telegramIds.js";

const escapeMarkdownV2 = (text) => {
    return text.replace(/[\~>#+\-=|{}.!]/g, '\\$&');
};

const message = `
🚨 HUGE news | [*M2THAK*](https://t.me/ElementalBlastNews/207) - faze clan member with 4.2 million followers is now the public ambassador for $ice and [*ElementalBlast*](https://t.me/+teYx8lkv6qQyZWRk).

✅ Featured with faze clan
✅ 4.2 Million Followers
✅ Huge connections
✅ Posting on IG, twitter and telegram
✅ Youtube pranks pioneer

🔥 50K USD BURN: in 24 hours the [*doxxed devs*](https://t.me/ElementalBlastNews/96) will burn 50.000 USD worth of $ice.

$ice season is here - and you don't want to miss out 🥶.

[*« Join the cult now »*](https://t.me/+HjegtrmARkswZTQ8)`;

const escapedMessage = escapeMarkdownV2(message);

const RATE_LIMIT_PER_SECOND = 25; // Global limit of 30 messages per second
const WAIT_TIME_MS = 1000 / RATE_LIMIT_PER_SECOND;

const BATCH_SIZE = 100; // Number of users to process in each batch
const DELAY_BETWEEN_BATCHES_MS = 60000; // 1 minute delay between batches to avoid overload

export const sendMessagesVideoToUsers = async (bot) => {
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
                    await bot.telegram.sendVideo(userId, 'BAACAgUAAyEFAASCbRtdAAIJfmcDZ0x0nErIEY2BnVXSmC-LUCYCAALrFAAC5tMhVDnNvr6nLn_fNgQ', {
                        caption: escapedMessage,
                        parse_mode: 'MarkdownV2',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Get $ice-d out 🥶', url: 'https://t.me/+HjegtrmARkswZTQ8' }],
                            ],
                        },
                        disable_web_page_preview: true
                    });
                    console.log(`Message with GIF sent to user ID: ${userId}`);
                } catch (sendError) {
                    if (sendError.response) {
                        if (sendError.response.error_code === 403) {
                            console.warn(`User ID ${userId} has blocked the bot or has privacy settings preventing messages.`);
                        } else if (sendError.response.error_code === 429) {
                            const retryAfter = sendError.response.parameters.retry_after;
                            console.warn(`Rate limit exceeded. Retrying after ${retryAfter} seconds.`);
                            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                            i--; // Retry the same user after waiting
                        } else {
                            console.error(`Failed to send message to user ID ${userId}: ${sendError.message}`);
                        }
                    } else {
                        console.error(`Failed to send message to user ID ${userId}: ${sendError.message}`);
                    }
                }

                lastSentTime = Date.now(); // Update last sent time
            }

            console.log('Finished processing a batch of users.');
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS)); // Delay between batches

        }

        console.log('Finished sending messages to all users.');
    } catch (error) {
        console.error('Error for send message gif to users', error.message);
    }
};
