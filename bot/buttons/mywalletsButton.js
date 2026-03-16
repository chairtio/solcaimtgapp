// buttons/mywalletsButton.js
import { urlTelegramWallets, urlTelegramUser, urlTelegramWallet } from '../private/private.js';
import { fetchData } from '../utils/fetchData.js';
import { claimButton } from '../storeMap/claimButton.js';
import { askBurnConfirmation, confirmBurnWallet } from './askBurnConfirmation.js';
import { checkSingleWallet } from '../storeMap/checkSingleWallet.js';
import { getTradingInfo, setTradingInfo } from '../trading/utilsTrading/redisUtilsTrading.js';

export const mywalletsButton = async (ctx) => {
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
        
        if (ctx.callbackQuery) {
            // Edit existing message
            await ctx.editMessageText(responseText, {
                reply_markup: {
                    inline_keyboard: inlineKeyboard
                }
            });
        } else if (ctx.message) {
            // Send a new message
            await ctx.reply(responseText, {
                reply_markup: {
                    inline_keyboard: inlineKeyboard
                }
            });
        }
    } catch (error) {
        console.error('Error fetching wallets:', error.message);
        await ctx.reply('Error. Please try again later.');
    }
};

// handleWalletActions
export const handleWalletActions = async (ctx) => {
    const action = ctx.match[0].split('_')[0];
    const walletId = ctx.match[0].split('_')[1];

    try {
        switch (action) {
            case 'wallet':
                await handleWalletInfo(ctx, walletId);
                break;
            case 'delete':
                await askDeleteConfirmation(ctx, walletId);
                break;
            case 'confirmdelete':
                await confirmDeleteWallet(ctx, walletId);
                break;
            case 'checkSingleWallet':
                await checkSingleWallet(ctx, walletId);
                break;
            case 'claim':
                await claimButton(ctx, walletId);
                break;
            case 'burn':
                await askBurnConfirmation(ctx, walletId);
                break; 
            case 'confirmBurn':
                await confirmBurnWallet(ctx, walletId);
                break; 
            default:
                await ctx.reply('Unknown action.');
        }
    } catch (error) {
        console.error('Error handling wallet action:', error.message);
        await ctx.reply('Error. Please try again later.');
    }
};

// handleWalletInfo
export const handleWalletInfo = async (ctx, walletId) => {
    try {
        const wallet = await fetchData(`${urlTelegramWallet}/${walletId}`);
        const spoilerPrivateKey = `||${wallet.private_key}||`;
        const walletInfo = `🔐 Wallet Info:\n` +
            `Address: \`${wallet.public_key}\`\n` +
            `Private Key: ${spoilerPrivateKey}`;

        await ctx.editMessageText(walletInfo, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔎 Check', callback_data: `checkSingleWallet_${wallet.id}` }, { text: '💰 Claim', callback_data: `claim_${wallet.id}` }],
                    [{ text: '🔥 Burn', callback_data: `burn_${wallet.id}` }, { text: '🗑 Delete', callback_data: `delete_${wallet.id}` }],
                    [{ text: '← Back', callback_data: 'mywallets' }]
                ],
            },
        });
        return wallet;
    } catch (error) {
        console.error('Error fetching wallet info:', error.message);
        await ctx.reply('Error. Please try again later.');
        return null;
    }
};

// deleteWallet
export const deleteWallet = async (ctx, walletId) => {
    try {
        const userId = ctx.from.id;
        
        // Call the API to delete the wallet
        await fetchData(`${urlTelegramWallet}/${walletId}/delete`, 'PUT');
        
        const tradingInfo = await getTradingInfo(userId);
        const allWallets = tradingInfo.wallets || {};
        const positionWallet = tradingInfo.positionWallet || {};

        delete allWallets[walletId];
        delete positionWallet[walletId];

        await setTradingInfo(userId, { 
            ...tradingInfo, 
            wallets: allWallets,
            positionWallet: positionWallet 
        });

        await mywalletsButton(ctx);
        await ctx.reply('✅ Wallet deleted successfully.');

    } catch (error) {
        console.error('Error deleting wallet:', error);
        await ctx.reply('Error. Please try again later.');
    }
};

// askDeleteConfirmation
export const askDeleteConfirmation = async (ctx, walletId) => {
    try {
        await ctx.editMessageText('🗑 Are you sure you want to delete this wallet?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Yes', callback_data: `confirmdelete_${walletId}_yes` }, { text: 'No', callback_data: `confirmdelete_${walletId}_no` }]
                ]
            }
        });
    } catch (error) {
        console.error('Error in askDeleteConfirmation:', error.message);
    }
};

// confirmDeleteWallet
export const confirmDeleteWallet = async (ctx, walletId) => {
    try {
        const confirmation = ctx.match[0].split('_')[2];

        if (confirmation === 'yes') {
            await deleteWallet(ctx, walletId);
        } else {
            await mywalletsButton(ctx);
        }
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in confirmDeleteWallet:', error.message);
    }
};

