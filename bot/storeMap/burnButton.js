// storeMap/burnButton.js
import { checkClaim, getTokenData, clearTokenData } from './checkClaim.js';
import { SOL_CLAIM_PER_TOKEN_ACCOUNT, TIMEOUT_MS } from '../private/private.js';
import pTimeout from '../utils/pTimeout.js';
import { burnallChecked } from './burnall.js';
import { fetchWalletData } from '../utils/fetchWalletData.js';

export async function burnButton(ctx, walletId = null) {
    const userId = ctx.from.id;

    try {
        const walletList = await fetchWalletData(userId, walletId);

        if (walletList.length === 0) {
            await ctx.reply('No connected wallets found.');
            return;
        }

        // Display the loading message and get the message ID
        const loadingMessage = await ctx.editMessageText(`🟠 Burning tokens from 0/${walletList.length} wallets…`);
        const messageId = loadingMessage.message_id;

        const results = [];
        const errors = [];
        let anyTokensBurned = false;

        // Process each wallet sequentially to maintain order and update progress
        for (let i = 0; i < walletList.length; i++) {
            const wallet = walletList[i];
            const address = wallet.public_key;

            try {
                // Update progress
                await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, `🟠 Burning tokens from ${i + 1}/${walletList.length} wallets…`);

                // Check claim with timeout
                await pTimeout(checkClaim(address, userId), TIMEOUT_MS);

                // Get token data
                const { tokenAccounts, zeroAmountAccountsCount } = await getTokenData(userId);
                const solToClaim = tokenAccounts.length * SOL_CLAIM_PER_TOKEN_ACCOUNT;

                if (solToClaim > 0) {
                    try {
                        const burnResult = await pTimeout(burnallChecked(wallet, userId, ctx), TIMEOUT_MS);
                        // console.log('burnResult:', burnResult); // Log the burn result for debugging

                        if (burnResult.success) {
                            anyTokensBurned = true;
                            results.push({
                                address,
                                success: true
                            });
                        } else {
                            // console.error('Error burning tokens:', burnResult.message);
                            results.push({
                                address,
                                success: false
                            });
                        }
                    } catch (error) {
                        // console.error('Error burning tokens:', error);
                        results.push({
                            address,
                            success: false
                        });
                    }
                } else {
                    results.push({
                        address,
                        success: false
                    });
                }
            } catch (error) {
                console.error('Error processing address:', address, error.message);
                // errors.push(`Error processing wallet. Please try again.`);
            }
        }

        // Determine the message based on whether any tokens were burned
        let message;
        let replyMarkup;

        if (anyTokensBurned) {
            message = `🔥 Burn succeeded! Tokens have been burned from ${results.length} wallets.`;
            replyMarkup = {
                inline_keyboard: [
                    [{ text: '💰 Claim SOL', callback_data: 'claim' }],
                    [{ text: '🐦 Tweet about us', url: `x.com/share?text=I%20just%20burned%20all%20tokens%20for%20free%20with%20@solclaimx!%20Try%20it%20out%20in%20their%20telegram%20bot.&url=https://t.me/solclaimxbot&hashtags=solclaim,solana,airdrop,crypto,free`}],
                    [{ text: '← Back', callback_data: 'mywallets'}]
                ]
            };
        } else if (results.length > 0) {
            message = `🟠 No tokens available to burn.`;
            replyMarkup = {
                inline_keyboard: [
                    [{ text: '← Back', callback_data: 'mywallets'}]
                ]
            };
        } else {
            message = `❌ Burn failed, please try again.`;
            replyMarkup = {
                inline_keyboard: [
                    [{ text: '← Back', callback_data: 'mywallets'}]
                ]
            };
        }

        await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, message, { reply_markup: replyMarkup });

        // Handle any errors that occurred
        if (errors.length > 0) {
            const errorMessage = errors.join('\n');
            // await ctx.reply(errorMessage);
        }

    } catch (error) {
        console.error('Error burn button:', error.message);
        await ctx.reply('Failed to burn. Please try again later.');
    } finally {
        const userId = ctx.from.id;
        clearTokenData(userId);
    }
}
