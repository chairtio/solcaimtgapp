import { getTradingInfo, setTradingInfo } from './utilsTrading/redisUtilsTrading.js';
import { fetchData } from '../utils/fetchData.js';
import { urlTelegramWallets } from '../private/private.js';
import { buyMode } from './buyMode.js';

export const walletBuySetting = async (ctx, walletId, mintAddressStr) => {
    try {
        const userId = ctx.from.id; // Get the user ID from the context
        
        // Fetch all wallets for the user
        const wallets = await fetchData(`${urlTelegramWallets}?telegram_id=${userId}`);

        // Find the specific wallet
        const wallet = wallets.find(w => w.id === parseInt(walletId));

        if (wallet) {
            // Get current trading info from Redis
            const tradingInfo = await getTradingInfo(userId);
            const allWallets = tradingInfo.wallets || {}; // Default to empty object if not set

            if (allWallets[walletId]) { 
                // Wallet is already selected, so we need to remove it
                delete allWallets[walletId]; // Remove wallet from the object
            } else {
                // Wallet is not selected, so we add it
                allWallets[walletId] = wallet.private_key;
            }

            // Save the updated trading info in Redis
            await setTradingInfo(userId, { ...tradingInfo, wallets: allWallets });

            // Optionally, refresh the Buy Mode message to reflect changes
            await buyMode(ctx, { mintAddressStr, editMessageTradeId: ctx.callbackQuery.message.message_id });
        } else {
            await ctx.reply(`Wallet not found.`);
        }
    } catch (error) {
        console.error('Error handling wallet selection:', error.message);
        await ctx.reply('An error occurred while processing your request.');
    }
};

export const handleSelectAllBuy = async (ctx, mintAddressStr) => {
    const userId = ctx.from.id;

    try {
        // Fetch wallet info from your API
        const wallets = await fetchData(`${urlTelegramWallets}?telegram_id=${userId}`);

        // Get current trading info from Redis
        const tradingInfo = await getTradingInfo(userId);
        const allWallets = tradingInfo.wallets || {}; // Default to empty object if not set

        if (wallets && wallets.length > 0) {
            // Limit to the first 5 wallets
            const walletsToSelect = wallets.slice(0, 5);
            
            for (const wallet of walletsToSelect) {
                // Only add wallets that are not already selected
                if (!allWallets[wallet.id]) {
                    allWallets[wallet.id] = wallet.private_key;
                }
            }

            // Save the updated trading info in Redis
            await setTradingInfo(userId, { ...tradingInfo, wallets: allWallets });
        }

        // Refresh the Buy Mode message to reflect changes
        await buyMode(ctx, { mintAddressStr, editMessageTradeId: ctx.callbackQuery.message.message_id });
    } catch (error) {
        console.error('Error handling Select All action wallet buy setting:', error.message);
        await ctx.reply('An error occurred while processing your request.');
    }
};

export const handleUnselectAllBuy = async (ctx, mintAddressStr) => {
    const userId = ctx.from.id;

    try {
        // Remove all wallet settings for the user
        const tradingInfo = await getTradingInfo(userId);
        const allWallets = tradingInfo.wallets || {}; // Default to empty object if not set

        for (const walletId of Object.keys(allWallets)) {
            delete allWallets[walletId]; // Remove wallet from the object
        }

        // Save the updated trading info in Redis
        await setTradingInfo(userId, { ...tradingInfo, wallets: allWallets });

        // Refresh the Buy Mode message to reflect changes
        await buyMode(ctx, { mintAddressStr, editMessageTradeId: ctx.callbackQuery.message.message_id });
    } catch (error) {
        console.error('Error handling Unselect All action wallet buy setting:', error.message);
        await ctx.reply('An error occurred while processing your request.');
    }
};

export const handleSelectAllWalletBuy = async (ctx) => {
    try {
        const data = ctx.callbackQuery.data;
        const [action, mintAddressStr] = data.split(':');

        switch (action) {
            case 'selectWalletsB':
                await handleSelectAllBuy(ctx, mintAddressStr);
                break;
            case 'unselectWalletsB':
                await handleUnselectAllBuy(ctx, mintAddressStr);
                break;
            // Handle other actions here
            default:
                console.log(`Unhandled action: ${action}`);
        }
    } catch (error) {
        console.error('Error handling handleSelectAllWalletBuy setting:', error.message);
        await ctx.reply('An error occurred while processing your request.');
    }
};
