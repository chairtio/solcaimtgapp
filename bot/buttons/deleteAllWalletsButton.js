// buttons/deleteAllWalletsButton.js
import { urlDeleteAllWallets } from '../private/private.js';
import { mywalletsButton } from './mywalletsButton.js';
import { fetchData } from '../utils/fetchData.js';
import { getTradingInfo, setTradingInfo } from '../trading/utilsTrading/redisUtilsTrading.js';

export const askDeleteAllWalletsConfirmation = async (ctx) => {
    try {
        await ctx.editMessageText('🗑 Are you sure you want to delete all wallets?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Yes', callback_data: 'confirmDeleteAllWallets_yes' }, { text: 'No', callback_data: 'confirmDeleteAllWallets_no' }]
                ]
            }
        });
    } catch (error) {
        console.error('Error asking for delete confirmation:', error.message);
        await ctx.reply('An error occurred while asking for confirmation. Please try again later.');
    }
};

export const confirmDeleteAllWallets = async (ctx) => {
    const confirmation = ctx.match[0].split('_')[1];

    try {
        if (confirmation === 'yes') {
            const userId = ctx.from.id;
            const payload = { telegram_id: userId };

            try {
                await fetchData(urlDeleteAllWallets, 'PUT', payload);

                // Remove all wallet settings and positionWallet for the user from Redis
                const tradingInfo = await getTradingInfo(userId);
                const allWallets = tradingInfo.wallets || {};
                const positionWallet = tradingInfo.positionWallet || {};

                // Delete wallets
                for (const walletId of Object.keys(allWallets)) {
                    delete allWallets[walletId];
                }

                // Delete positionWallet
                for (const walletId of Object.keys(positionWallet)) {
                    delete positionWallet[walletId];
                }

                // Save updated trading info
                await setTradingInfo(userId, { 
                    ...tradingInfo, 
                    wallets: allWallets, 
                    positionWallet: positionWallet 
                });

                await ctx.reply('✅ All wallets deleted successfully.');
                await mywalletsButton(ctx);
            } catch (error) {
                console.error('Error deleting all wallets:', error);
                await ctx.reply('Failed to delete all wallets. Please try again later.');
            }
        } else {
            await mywalletsButton(ctx);
        }
    } catch (error) {
        console.error('Error in confirmDeleteAllWallets:', error.message);
        await ctx.reply('Failed to process your request. Please try again later.');
    }
};
