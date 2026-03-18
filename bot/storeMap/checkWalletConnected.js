// storeMap/checkWalletConnected.js

import { fetchWalletData } from '../utils/fetchWalletData.js';
import { checkClaim, getTokenData, clearTokenData } from './checkClaim.js';
import { computeNetPayoutPerAccount } from '../private/private.js';
import { getRefereeReferralPercentCached } from '../lib/supabase-bot.js';
import pTimeout from '../utils/pTimeout.js';

const TIMEOUT_MS = 60000;

const BATCH_SIZE = 10;

export async function checkWalletConnected(ctx, walletId = null) {
    const userId = ctx.from.id;

    try {
        const walletList = await fetchWalletData(userId, walletId);

        if (walletList.length === 0) {
            await ctx.reply('No connected wallets found.');
            return;
        }

        // Display the initial loading message and get the message ID
        let progressMessage = await ctx.editMessageText(`🟠 Checking 0/${walletList.length} wallets...`);

        const updateProgress = async (i) => {
            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, `🟠 Checking ${i}/${walletList.length} wallets...`);
        };

        const results = [];
        const walletBatches = [];
        const startTime = Date.now();

        // Split walletList into batches
        for (let i = 0; i < walletList.length; i += BATCH_SIZE) {
            walletBatches.push(walletList.slice(i, i + BATCH_SIZE));
        }

        let processedWallets = 0;
        const referralPercent = await getRefereeReferralPercentCached(userId);
        const netPerAccount = computeNetPayoutPerAccount(referralPercent);

        for (const batch of walletBatches) {
            const timeSpent = Date.now() - startTime;
            const remainingTime = TIMEOUT_MS - timeSpent;
            const timeoutPerBatch = Math.max(remainingTime / (walletBatches.length - walletBatches.indexOf(batch)), 1000);

            await Promise.all(batch.map(async (wallet) => {
                const { public_key: address } = wallet;
                try {
                    await pTimeout(checkClaim(address, userId), timeoutPerBatch);

                    const { tokenAccounts, zeroAmountAccountsCount } = await getTokenData(userId);
                    const solToClaim = tokenAccounts.length * netPerAccount;
                    const solAbleToClaim = zeroAmountAccountsCount * netPerAccount;

                    results.push({
                        address,
                        solToClaim: solToClaim.toFixed(4),
                        solAbleToClaim: solAbleToClaim.toFixed(4),
                        order: walletList.findIndex(w => w.public_key === address)
                    });
                } catch (error) {
                    console.error('Error processing address:', address, error.message);
                    results.push({ 
                        address, 
                        error: 'Error processing address', 
                        order: walletList.findIndex(w => w.public_key === address) 
                    });
                } finally {
                    processedWallets++;
                    await updateProgress(processedWallets);
                }
            }));

            if (Date.now() - startTime > TIMEOUT_MS) {
                break;
            }
        }

        results.sort((a, b) => a.order - b.order);

        if (results.length > 0) {
            const resultsMessage = results.map(res =>
                res.error
                    ? `Wallet: ${res.address.substring(0, 4)}...\n❌ ${res.error}`
                    : `Wallet: ${res.address.substring(0, 4)}...\n💰 Available to claim: ${res.solAbleToClaim} SOL${res.solToClaim > res.solAbleToClaim
                        ? `\n🔥 Burn tokens to claim: ${res.solToClaim} SOL`
                        : ''
                    }`
            ).join('\n\n');

            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, `${resultsMessage}`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💰 Claim all wallets', callback_data: 'claim' }],
                        [{ text: '🔥 Burn all wallets', callback_data: 'burntokensButton' }],
                        [{ text: '← Back', callback_data: 'mywallets'}]
                    ]
                }
            });
        } else {
            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, '❌ No results found.');
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (progressMessage) {
            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, '❌ Failed to check connected wallets. Please try again later.');
        } else {
            await ctx.reply('❌ Failed to check connected wallets. Please try again later.');
        }
    } finally {
        const userId = ctx.from.id;
        clearTokenData(userId);
    }
}
