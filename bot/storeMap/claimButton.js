// storeMap/claimButton.js

import { fetchDataReferral } from '../utils/fetchDataReferral.js';
import { fetchWalletData } from '../utils/fetchWalletData.js';
import { checkClaim, getTokenData, clearTokenData } from './checkClaim.js';
import { SOL_CLAIM_PER_TOKEN_ACCOUNT, TIMEOUT_MS, urlReferralBy } from '../private/private.js';
import pTimeout from '../utils/pTimeout.js';
import { closeTokenAccounts } from './close.js';
import { closeTokenAccountsWithReferral } from './closeReferral.js';
import { sendMessageToClaimsTopic } from '../utils/sendMessageToClaimsTopic.js';
import { getUserWithdrawWallet } from '../utils/getUserWithdrawWallet.js';
import { generateClaimedImage } from './generateClaimedImage.js';
import { getWalletBalance } from '../utils/getWalletBalance.js';
import { escapeMarkdownV2 } from '../utils/escapeMarkdownV2.js';

const DEFAULT_COMMISSION_PERCENTAGE = 10; // Default commission percentage (users.referrer_commission_percent ?? referrals.commission_percentage ?? 10)

export async function claimButton(ctx, walletId = null) {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || '';
    const lastName = ctx.from.last_name || '';
    const userFirstName = `${firstName} ${lastName}`.trim();
    const referralLink = `https://t.me/solclaimxbot?start=${userId}`;
    try {
        const walletList = await fetchWalletData(userId, walletId);

        if (walletList.length === 0) {
            await ctx.reply('No connected wallets found.');
            return;
        }

        let referrerId = null;
        let referrerWithdrawWallet = null;
        let commissionPercentage = DEFAULT_COMMISSION_PERCENTAGE;
        let referrerBalanceSufficient = true;
        try {
            // Fetch referral data
            const referralData = await fetchDataReferral(`${urlReferralBy}/${userId}`);
            referrerId = referralData ? referralData.telegram_id : null;
            commissionPercentage = referralData && referralData.commission_percentage !== undefined && referralData.commission_percentage !== null
            ? referralData.commission_percentage
            : DEFAULT_COMMISSION_PERCENTAGE;

            if (commissionPercentage === 0) {
                referrerId = null; // Skip referrer processing if commission is 0
            }

            if (referrerId) {
                // Fetch the withdrawal wallet of the referrer
                referrerWithdrawWallet = await getUserWithdrawWallet(referrerId);

                // Check if the referrer's withdrawal wallet balance is sufficient
                if (referrerWithdrawWallet) {
                    const balance = await pTimeout(getWalletBalance(referrerWithdrawWallet), TIMEOUT_MS);
                    if (balance < 0.0025) {
                        referrerBalanceSufficient = false;
                    }
                }
            }
        } catch (error) {
            console.warn('No referral data or withdrawal wallet found for user:', userId);
        }

        // Display the loading message and get the message ID
        const loadingMessage = await ctx.editMessageText(`🟠 Claiming SOL from 0/${walletList.length} wallets…`);
        const messageId = loadingMessage.message_id;

        const results = [];
        const errors = [];
        let totalClaimedOverall = 0;
        let withdrawalAddressNotFound = false; // Flag to track if the message has been sent

        // Process each wallet sequentially to maintain order and update progress
        for (let i = 0; i < walletList.length; i++) {
            const wallet = walletList[i];
            const { public_key: address, id: walletId } = wallet;

            try {
                // Update progress
                await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, `🟠 Claiming SOL from ${i + 1}/${walletList.length} wallets processed…\n\nPlease be patient while the network processes your request.`);

                // Check claim with timeout
                await pTimeout(checkClaim(address, userId), TIMEOUT_MS);

                // Get token data
                const { tokenAccounts, zeroAmountAccountsCount } = await getTokenData(userId);
                const solToClaim = tokenAccounts.length * SOL_CLAIM_PER_TOKEN_ACCOUNT;
                const solAbleToClaim = zeroAmountAccountsCount * SOL_CLAIM_PER_TOKEN_ACCOUNT;
                const solUnableToClaim = solToClaim - solAbleToClaim;

                if (solToClaim > 0) {
                    try {
                        const closeResult = referrerId && referrerWithdrawWallet && referrerBalanceSufficient
                            ? await pTimeout(closeTokenAccountsWithReferral(wallet, userId, ctx, walletId, referrerId, referrerWithdrawWallet, commissionPercentage), TIMEOUT_MS)
                            : await pTimeout(closeTokenAccounts(wallet, userId, ctx, walletId), TIMEOUT_MS);
                            
                        if (closeResult.success) {
                            results.push({
                                address,
                                totalClaimed: solAbleToClaim.toFixed(4),
                                solUnableToClaim: solUnableToClaim.toFixed(4),
                                success: true
                            });

                            totalClaimedOverall += parseFloat(solAbleToClaim.toFixed(4));

                        } else if (closeResult.message === 'User withdrawal wallet not found') {
                            if (!withdrawalAddressNotFound) {
                                // Send the message only once
                                await ctx.reply('No withdrawal address found. Please set your withdrawal address at /settings');
                                withdrawalAddressNotFound = true;
                            }
                            break; // Stop further processing
                        } else {
                            console.error('Error closing token accounts:', closeResult.message);
                            results.push({
                                address,
                                totalClaimed: solAbleToClaim.toFixed(4),
                                solUnableToClaim: solUnableToClaim.toFixed(4),
                                success: false
                            });
                        }
                    } catch (error) {
                        console.error('Error closing token accounts:', error);
                    }
                } else {
                    results.push({
                        address,
                        totalClaimed: 0,
                        solUnableToClaim: 0,
                        success: false,
                    });
                }
            } catch (error) {
                console.error('Error processing address:', address, error.message);
                errors.push(`Error processing wallet. Please try again.`);
            }
        }

        // Determine the message based on the results
        let message;
        let replyMarkup;

        if (results.length > 0) {
            const hasSuccessfulClaim = results.some(res => res.success);
            const totalClaimed = results
                .filter(res => res.success)
                .reduce((acc, res) => acc + parseFloat(res.totalClaimed), 0);

            if (hasSuccessfulClaim) {
                if (totalClaimed > 0) {
                    // Generate the image with the claimed amount
                    const walletLenght = results.length
                    const claimedImage = await generateClaimedImage(totalClaimed, walletLenght, 'solclaim.jpg');
                    const shareText = `Claim FREE Sol With SolClaim!

💰 Free SOL for every trader
🆕 First SOL trader rewards bot
🔐 Secure and safe (approved by Privy)

👉 Start getting free SOL with SolClaim today.

t.me/solclaimxbot?start=${userId}`;
                    const encodedText = encodeURIComponent(shareText);
                    const shareUrl = `https://t.me/share/url?url=t.me/solclaimxbot?start=${userId}&text=${encodedText}`;
                    
                    message = `✅ Claim succeeded\\!\n\n${escapeMarkdownV2(totalClaimed.toFixed(4))} SOL has been sent to your withdrawal wallet from ${results.length} wallets\\.

💸 Share your ref link and get ${commissionPercentage}% profit share \\(use \\#solclaim\\):
\`${referralLink}\``;
                    const tweetText = encodeURIComponent(`I just claimed ${totalClaimed.toFixed(4)} SOL for free with @solclaimx!\n\nTry it out in their telegram bot now: ${referralLink}\n\n#solclaim #solana #crypto`);
                    replyMarkup = {
                        inline_keyboard: [
                            // [{ text: '🔥 Join $SOLCLAIM Airdrop 👀', url: 'https://t.me/solclaimxbot/airdrop' }],
                            [{ text: '🐦 Tweet about us', url: `https://x.com/compose/post?text=${tweetText}` }],
                            [{ text: '💬 Share with friends', url: shareUrl }]
                        ]
                    };
                    // Send a new message with the image and text
                    await ctx.telegram.sendPhoto(
                        ctx.chat.id,
                        { source: claimedImage },
                        {
                            caption: message,
                            parse_mode: 'MarkdownV2',
                            reply_markup: replyMarkup
                        }
                    );
                    await ctx.telegram.deleteMessage(ctx.chat.id, messageId);

                } else {
                    message = `🔴 No SOL available to claim. Please try another wallet.`;
                    replyMarkup = {
                        inline_keyboard: [
                            [{ text: '← Back', callback_data: 'mywallets'}]
                        ]
                    };    
                    await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, message, { reply_markup: replyMarkup });

                };
            } else {
                message = `🟠 No SOL available to claim. Make sure it’s a wallet you used before to trade meme coins.`;
                replyMarkup = {
                    inline_keyboard: [
                        [{ text: '← Back', callback_data: 'mywallets'}]
                    ]
                };
                await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, message, { reply_markup: replyMarkup });
            }
        } else {
            message = `❌ Claim failed, please try again.`;
            replyMarkup = {
                inline_keyboard: [
                    [{ text: '← Back', callback_data: 'mywallets'}]
                ]
            };
            await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, message, { reply_markup: replyMarkup });

        }

        // Send a message to the private group with the total claimed SOL if it's greater than 0
        if (totalClaimedOverall > 0) {
            // Determine the color-coded icon based on the total claimed SOL
            let icon;
            if (totalClaimedOverall >= 0.1) {
                icon = '🟢';
            } else if (totalClaimedOverall >= 0.01) {
                icon = '🟡';
            } else if (totalClaimedOverall >= 0.0015) {
                icon = '🟠';
            } else {
                icon = '🔴';
            }
            const walletText = results.length === 1 ? 'wallet' : 'wallets';

            const groupMessage = `${icon} New claim: ${escapeMarkdownV2(totalClaimedOverall.toFixed(4))} SOL from ${results.length} ${walletText} by ${escapeMarkdownV2(userFirstName)}`;
            await sendMessageToClaimsTopic(ctx, groupMessage);

        }

        // Handle any errors that occurred
        if (errors.length > 0) {
            const errorMessage = errors.join('\n');
            // await ctx.reply(errorMessage);
        }

    } catch (error) {
        console.error('Error:', error.message);
        await ctx.reply('Failed to check connected wallets. Please try again later.');
    } finally {
        const userId = ctx.from.id;
        clearTokenData(userId);
    }
}

