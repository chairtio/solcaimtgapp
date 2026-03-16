// commands/startCommand.js
import { urlTelegramUser, urlReferral } from '../private/private.js';
import { fetchData } from '../utils/fetchData.js';
import { getUserWithdrawWallet } from '../utils/getUserWithdrawWallet.js';
import { fetchStats } from '../utils/fetchStats.js';
import { redis } from "../private/private.js";
import pTimeout from '../utils/pTimeout.js';

const groupId = '-1002188188509';

export const testCommand = async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username;

    try {
        // Parse referral ID from the start command arguments, if available
        const startArgs = ctx.message.text.split(' ')[1];
        let referrerId = null;
        if (startArgs) {
            referrerId = startArgs;
            console.log(`Referral ID found: ${referrerId}`);
        }

        // Fetch user data
        let userResponse;
        try {
            userResponse = await fetchData(`${urlTelegramUser}/${userId}`);
            console.log(`User data fetched: ${JSON.stringify(userResponse)}`);

        } catch (error) {
            console.log(`User not found, creating new user with ID: ${userId}`);

            // If the user does not exist, create a new user
            await fetchData(urlTelegramUser, 'POST', { telegram_id: userId, username: username });
            console.log(`New user created with ID: ${userId}`);
            
            userResponse = await fetchData(`${urlTelegramUser}/${userId}`);
            console.log(`User data fetched after creation: ${JSON.stringify(userResponse)}`);

            // Store the time when the user was created
            try {
                await pTimeout(redis.set(`userCreationTime:${userId}`, Date.now(), 'EX', 7200), 10000);
            } catch (error) {
                console.error('Failed to set user creation time in Redis', error.message);
            }

            // If the user is being referred, record the referral
            if (referrerId) {
                console.log(`Recording referral: referrer ${referrerId}, referred ${userId}`);
                try {
                    const referralPayload = {
                        referrer_telegram_id: parseInt(referrerId, 10),
                        referred_telegram_id: userId
                    };
                    await fetchData(urlReferral, 'POST', referralPayload);
                    console.log(`Referral recorded successfully`);
                } catch (error) {
                    console.log(`Failed to record referral: ${error}`);
                }
            }
        }

        // Fetch stats data and user withdrawal wallet data in parallel
        const [statsData, userWithdrawWallet] = await Promise.all([fetchStats(), getUserWithdrawWallet(userId)]);

        // Prepare response text with fetched stats
        const statsDataUsersStr = statsData.users.toString().replace('.', '\\.');
        const statsDataClaimedStr = statsData.claimed.toFixed(4).toString().replace('.', '\\.');
        let responseText = `💰 Solclaim: Reclaim Your Sol\\! 🤖\n`;
        responseText += `\n📊 Stats: ${statsDataUsersStr} users have already claimed ${statsDataClaimedStr} SOL in total\\!\n\n`;
        responseText += `[Group](https://t.me/SolClaimChat) \\| [Channel](https://t.me/SolClaimPortal) \\| [Twitter](https://x.com/solclaimx) \\| [Website](https://solclaim.io)\n\n`;
        responseText += `If you've traded or received tokens on Solana \\(like Raydium or Pumpfun\\)\\, use [SolClaim](https://solclaim.io) to check if you're eligible to claim back sol FOR FREE\\. 💰`;

        // Update response text and buttons based on user withdrawal wallet status
        if (userWithdrawWallet) {
            const userPublicKey = userWithdrawWallet.toBase58();
            responseText += `\n\n✅ Your withdrawal address: \\(${userPublicKey.substring(0, 4)}\\.\\.\\.\\) has been saved /settings\\.\n\nTo see all the options go to the /menu\\.`;
        } else {
            responseText += `\n\nTo get started\\, set your withdrawal address by clicking below \\(will be used to send your FREE sol\\)\\.`;
            responseText += `\n\nTo see all the options go to the /menu\\.`;
        }

        // Send video message with the final caption
        const videoFileId = 'BAACAgUAAyEFAASCbRtdAAIBs2bA6MH6tZkQVxeGUjd7KdmQZoV-AAJ7EwACUIcJVoT81E_LalIBNQ';
        await ctx.replyWithVideo(videoFileId, {
            caption: responseText,
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [{ text: userWithdrawWallet ? '📖 Menu' : '💳 Set withdrawal address', callback_data: userWithdrawWallet ? 'menuReply' : 'settingWithdrawAddress' }]
                ],
            },
            disable_web_page_preview: true
        });      
    } catch (error) {
        console.error('Failed to start command', error.message);

        // Forward video message
        if (error.message.includes('wrong file identifier/HTTP URL specified')) {
            try {
                // Forward video message to refresh the file ID
                await ctx.telegram.forwardMessage(
                    groupId,          // Target group ID
                    groupId,          // Source group ID (where the video was initially sent)
                    435 // Message ID of the video
                );
                console.log('Message forwarded successfully to refresh file ID');   
            } catch (forwardError) {
                console.error('Failed to forward message:', forwardError.message);
            }
        }

        // Notify user and send error to the group
        try {
            // Forward video message to refresh the file ID
            await ctx.telegram.forwardMessage(
                groupId,          // Target group ID
                groupId,          // Source group ID (where the video was initially sent)
                435 // Message ID of the video
            );
            console.log('Message forwarded successfully to refresh file ID');   
        } catch (forwardError) {
            console.error('Failed to forward message:', forwardError.message);
        }
        // await ctx.reply('Failed to test. Please try again later.');
        await ctx.telegram.sendMessage(groupId, `Error in test Command: ${error.message}`);
    }
}
