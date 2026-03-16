// storeMap/checkSingleWallet.js

import { fetchWalletData } from '../utils/fetchWalletData.js';
import { checkClaim, getTokenData, clearTokenData } from './checkClaim.js';
import { SOL_CLAIM_PER_TOKEN_ACCOUNT } from '../private/private.js';
import pTimeout from '../utils/pTimeout.js';

const TIMEOUT_MS = 60000;

export async function checkSingleWallet(ctx, walletId) {
    const userId = ctx.from.id;

    try {
        const walletList = await fetchWalletData(userId, walletId);

        if (walletList.length === 0) {
            await ctx.reply('No connected wallet found.');
            return;
        }

        const wallet = walletList[0]; // Since we're checking only one wallet
        const { public_key: address } = wallet;

        // Display the initial loading message
        let progressMessage = await ctx.editMessageText(`🟠 Checking wallet...`);

        try {
            await pTimeout(checkClaim(address, userId), TIMEOUT_MS);

            const { tokenAccounts, zeroAmountAccountsCount } = await getTokenData(userId);
            const solToClaim = tokenAccounts.length * SOL_CLAIM_PER_TOKEN_ACCOUNT;
            const solAbleToClaim = zeroAmountAccountsCount * SOL_CLAIM_PER_TOKEN_ACCOUNT;

            const resultMessage = `Wallet: ${address.substring(0, 4)}...\n💰 Available to claim: ${solAbleToClaim} SOL${solToClaim > solAbleToClaim
                ? `\n🔥 Burn tokens to claim: ${solToClaim} SOL`
                : ''
            }`;

            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, resultMessage, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💰 Claim', callback_data: `claim_${wallet.id}` }],
                        [{ text: '🔥 Burn', callback_data: `burn_${wallet.id}` }],
                        [{ text: '← Back', callback_data: 'mywallets' }]
                    ]
                }
            });

        } catch (error) {
            console.error('Error processing address:', address, error.message);
            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, `❌ Error processing wallet: ${address.substring(0, 4)}...`);
        }

    } catch (error) {
        console.error('Error:', error.message);
        await ctx.reply('❌ Failed to check wallet. Please try again later.');
    } finally {
        const userId = ctx.from.id;
        clearTokenData(userId);
    }
}
