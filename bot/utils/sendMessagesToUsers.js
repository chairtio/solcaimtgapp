import { userIds } from "./telegramIds.js";

const escapeMarkdownV2 = (text) => {
    return text.replace(/[\~>#+\-=|{}.!]/g, '\\$&');
};

const message = `🔊 [*SOLCLAIM*](https://t.me/solclaimiobot) is now being advertised on solscan.io!

Just one step more in our marketing efforts to push SolClaim until it becomes a stander tool in every Solana traders’ kit. 

✅ KYC project
✅ Huge marketing
✅ No risk and 100% free

If you've traded or received tokens on Solana \\(like Raydium or Pumpfun\\), use [SolClaim](https://t.me/solclaimiobot) to check if you're eligible to claim back sol FOR FREE. 💸

📊 Total claims to date: 106.53+ SOL
🆕 First ever Solana bot to do this
🎉 EVERYONE that traded on Solana gets FREE SOL

Millions of traders just like you have $100+ of fees stuck in their wallet, which they can reclaim. [SolClaim](https://t.me/solclaimiobot), makes this simple with just a few clicks.

[Try SolClaim Now](https://t.me/solclaimiobot) or watch this [video demo](https://t.me/SolClaimPortal/149).`;

// Escape MarkdownV2 special characters in the message
const escapedMessage = escapeMarkdownV2(message);

const RATE_LIMIT_PER_SECOND = 2; // Number of messages per second
const WAIT_TIME_MS = 1000 / RATE_LIMIT_PER_SECOND;

const BATCH_SIZE = 100; // Number of users to process in each batch

export const sendMessagesToUsers = async (bot) => {
    try{
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
                    await bot.telegram.sendMessage(userId, escapedMessage, {
                        parse_mode: 'MarkdownV2',
                        disable_web_page_preview: true
                    });
                    console.log(`Message sent to user ID: ${userId}`);
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
        }

        console.log('Finished sending messages to all users.');
    } catch (error) {
        console.error('Error for send message to users', error.message);
    }
};
