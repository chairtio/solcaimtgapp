// confirmButton/askBurnConfirmation.js
import { burnButton } from '../storeMap/burnButton.js';
import { mywalletsButton } from './mywalletsButton.js';

export const askBurnConfirmation = async (ctx, walletId) => {
    try {
        await ctx.editMessageText('⚠️ Are you sure you want to burn ALL tokens in this wallet? Any token that is not SOL (including USDT, USDC, NFT ...) will be burned.\n\nWe recommend to use only empty wallet for this function.\n\nProceed with burning?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Yes', callback_data: `confirmBurn_${walletId}_yes` }, { text: 'No', callback_data: `confirmBurn_${walletId}_no` }]
                ]
            }
        });
    } catch (error) {
        console.error('Error in askBurnConfirmation:', error.message);
    }
};

export const confirmBurnWallet = async (ctx, walletId) => {
    try {
        const confirmation = ctx.match[0].split('_')[2];
        const messageId = ctx.update.callback_query.message.message_id;

        if (confirmation === 'yes') {
            // await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
            await burnButton(ctx, walletId);
        } else {
            await mywalletsButton(ctx);
            // await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
        }
    } catch (error) {
        console.error('Error in confirmBurnWallet:', error.message);
    }
};

// Burn all
export const askBurnAllConfirmation = async (ctx) => {
    try {
        await ctx.editMessageText('⚠️ Are you sure you want to burn ALL tokens in your account? Any token that is not SOL (including USDT, USDC, NFT ...) will be burned.\n\nWe recommend to use only empty wallets for this function.\n\nProceed with burning?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Yes', callback_data: 'confirmBurnAll_yes' }, { text: 'No', callback_data: 'confirmBurnAll_no' }]
                ]
            }
        });
    } catch (error) {
        console.error('Error in askBurnAllConfirmation:', error.message);
    }
};

export const confirmBurnAllWallets = async (ctx) => {
    try {
        const confirmation = ctx.match[0].split('_')[1];
        if (confirmation === 'yes') {
            await burnButton(ctx);
        } else {
            await mywalletsButton(ctx);
        }
    } catch (error) {
        console.error('Error in confirmBurnAllWallets:', error.message);
    }
};
