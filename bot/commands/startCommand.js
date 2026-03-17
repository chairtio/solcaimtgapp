// commands/startCommand.js
import { urlTelegramUser, urlReferral } from '../private/private.js';
import { fetchData } from '../utils/fetchData.js';
import { getUserWithdrawWallet } from '../utils/getUserWithdrawWallet.js';
import { fetchStats } from '../utils/fetchStats.js';
import { redis } from "../private/private.js";
import pTimeout from '../utils/pTimeout.js';
import { fetchTokenDataCommand } from '../trading/fetchTrade.js'
import { deleteMessages } from '../utils/deleteMessages.js';
import { deleteToken, hideToken } from '../trading/position.js';
const groupId = '-1002188188509';
export const startCommand = async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username;
    
    // // Save userId to Redis
    // redis.sadd('telegramUsers', userId).catch(err => {
    //     console.warn(`[Redis] Failed to add userId ${userId}: ${err.message}`);
    // });
    
    try {
        // Parse referral ID, action, and token mint from the start command arguments, if available
        const startArgs = ctx.message.text.split(' ')[1];
        let referrerId = null;
        let action = null;
        let tokenMint = null;

        if (startArgs) {
            // Handle actions: trade, hide, delete
            if (startArgs.startsWith('trade-') || startArgs.startsWith('hide-') || startArgs.startsWith('delete-')) {
                [action, tokenMint] = startArgs.split('-');

                if (action === 'trade') {
                    await fetchTokenDataCommand(ctx, tokenMint);
                    await deleteMessages(ctx, [ctx.message.message_id]);
                    return;
                } else if (action === 'hide') {
                    await hideToken(ctx, tokenMint);
                    return;
                } else if (action === 'delete') {
                    await deleteToken(ctx, tokenMint);
                    return;
                }
            } 
            // Handle referral with tokenMint in format refid-token
            else if (startArgs.includes('-')) {
                [referrerId, tokenMint] = startArgs.split('-');
                console.log(`Referral ID: ${referrerId}, Token Mint: ${tokenMint}`);
            } 
            // Handle simple referral ID (no token mint)
            else {
                referrerId = startArgs;
                console.log(`Referral ID found: ${referrerId}`);
            }
        }

        // Fetch user data or create a new user if it doesn't exist
        let userResponse;
        try {
            userResponse = await fetchData(`${urlTelegramUser}/${userId}`);
            console.log(`User data fetched: ${JSON.stringify(userResponse)}`);
        } catch (error) {
            try {
                // User does not exist, create a new one
                userResponse = await fetchData(urlTelegramUser, 'POST', { telegram_id: userId, username: username });
                console.log(`New user created: ${JSON.stringify(userResponse)}`);
            } catch (createError) {
                // Duplicate key = user already exists (e.g. from mini app), fetch and continue
                if (createError?.code === '23505' || createError?.message?.includes('duplicate key')) {
                    userResponse = await fetchData(`${urlTelegramUser}/${userId}`);
                } else {
                    throw createError;
                }
            }

            // If the user was referred by someone, record the referral
            if (referrerId && userResponse) {
                console.log(`Recording referral: referrer ${referrerId}, referred ${userId}`);
                try {
                    const referralPayload = {
                        referrer_telegram_id: parseInt(referrerId, 10),
                        referred_telegram_id: userId
                    };
                    await fetchData(urlReferral, 'POST', referralPayload);
                } catch (refError) {
                    console.log(`Failed to record referral: ${refError}`);
                }
            }
        }

        // If tokenMint is provided
        if (tokenMint && !action) {
            try {
                await fetchTokenDataCommand(ctx, tokenMint);
                await deleteMessages(ctx, [ctx.message.message_id]);
                return;
            } catch (error) {
                console.error(`Error processing tokenMint startcommand: ${error.message}`);
            }
        }

        // Fetch stats data and user withdrawal wallet data in parallel
        const [statsData, userWithdrawWallet] = await Promise.all([fetchStats(), getUserWithdrawWallet(userId)]);

        // Prepare response text with fetched stats
        const statsDataUsersStr = statsData.users.toString().replace('.', '\\.');
        const statsDataClaimedStr = statsData.claimed.toFixed(4).toString().replace('.', '\\.');
        let responseText = `💰 Solclaim: Reclaim Your Sol\\! 🤖\n`;
        responseText += `\n📊 Stats: ${statsDataUsersStr} users have already claimed ${statsDataClaimedStr} SOL in total\\!\n\n`;
        responseText += `[Group](https://t.me/SolClaimChat) \\| [Channel](https://t.me/SolClaimPortal) \\| [Trending](https://t.me/solclaimtrending) \\| [Twitter](https://x.com/solclaimx)\n\n`;
        responseText += `If you've traded or received tokens on Solana \\(like Raydium or Pumpfun\\)\\, use SolClaim to check if you're eligible to claim back sol FOR FREE\\. 💰`;

        // Update response text and buttons based on user withdrawal wallet status
        if (userWithdrawWallet) {
            const userPublicKey = userWithdrawWallet.toBase58();
            responseText += `\n\n✅ Your withdrawal address: \\(${userPublicKey.substring(0, 4)}\\.\\.\\.\\) has been saved /settings\\.\n\nTo see all the options go to the /menu\\.`;
        } else {
            responseText += `\n\nTo get started\\, set your withdrawal address by clicking below \\(will be used to send your FREE sol\\)\\.`;
            responseText += `\n\nTo see all the options go to the /menu\\.`;
        }

        // Send video message with the final caption
        const videoFileId = 'BAACAgUAAyEFAASCbRtdAAIBs2bA6MH6tZkQVxeGUjd7KdmQZoV-AAJ7EwACUIcJVoT81E_LalIBNQQ';
        await ctx.replyWithVideo(videoFileId, {
            caption: responseText,
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    // [{ text: '🔥 Join $SOLCLAIM Airdrop 👀', url: 'https://t.me/solclaimiobot/airdrop' }],
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
        await ctx.reply('Failed to start. Please try again later.');
        await ctx.telegram.sendMessage(groupId, `Error in startCommand: ${error.message}`);
    }
}


