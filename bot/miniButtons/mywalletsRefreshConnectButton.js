// buttons/mywalletsRefreshConnectButton.js
import { deleteMessageId } from '../utils/redisUtils.js';
import { urlTelegramWallets, urlTelegramUser } from '../private/private.js';
import { fetchData } from '../utils/fetchData.js';

export const mywalletsRefreshConnectButton = async (ctx, editMessageConnectId) => {
    try {
        const userId = ctx.from.id;
        let userResponse;

        try {
            userResponse = await fetchData(`${urlTelegramUser}/${userId}`);
        } catch (error) {
            // If user doesn't exist, create a new user
            await fetchData(urlTelegramUser, 'POST', { telegram_id: userId, username: ctx.from.username });
            userResponse = await fetchData(`${urlTelegramUser}/${userId}`);
        }

        const wallets = await fetchData(`${urlTelegramWallets}?telegram_id=${userId}`);

        let responseText = '🔗 Your connected wallets:\n\n';
        const inlineKeyboard = [];

        wallets.forEach((wallet, index) => {
            inlineKeyboard.push([
                { text: `${index + 1}. ${wallet.public_key}`, callback_data: `wallet_${wallet.id}` },
                { text: '💰 Claim SOL', callback_data: `claim_${wallet.id}` },
                { text: '🗑️ Delete', callback_data: `delete_${wallet.id}` }
            ]);
        });

        inlineKeyboard.push([{ text: '➕ Connect wallet(s)', callback_data: 'connect' }, { text: '🗑️ Delete all', callback_data: 'deleteAllWallets' }]);
        inlineKeyboard.push([{ text: '➕ Generate New Wallet', callback_data: 'generateWallet' }, { text: '🔥 Burn all tokens', callback_data: 'burntokensButton' }]);
        inlineKeyboard.push([{ text: '🔎 Check all wallets', callback_data: 'checkWalletConnected' }, { text: '💰 Claim all wallets', callback_data: 'claim' }]);
        inlineKeyboard.push([{ text: '← Back', callback_data: 'menu' }]);

        await ctx.telegram.editMessageText(ctx.chat.id, editMessageConnectId, null, responseText, {
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        });

        deleteMessageId(userId, 'connect');

    } catch (error) {
        console.error('Error mywallets Refresh Connect Button:', error.message);
        await ctx.reply('Error. Please try again later.');
    }
};
