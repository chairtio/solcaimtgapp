import { getTradingInfo, setTradingInfo } from './utilsTrading/redisUtilsTrading.js';
import { fetchData } from '../utils/fetchData.js';
import { urlTelegramWallets } from '../private/private.js';
import { positionsCommand } from './position.js';

export const walletPositionSetting = async (ctx, walletId) => {
    try {
        const userId = ctx.from.id; // Get the user ID from the context
        
        // Fetch all wallets for the user
        const wallets = await fetchData(`${urlTelegramWallets}?telegram_id=${userId}`);

        // Find the specific wallet
        const wallet = wallets.find(w => w.id === parseInt(walletId));

        if (wallet) {
            // Get current trading info from Redis
            const tradingInfo = await getTradingInfo(userId);
            
            // Instead of having multiple wallets, we store only one wallet in tradingInfo.positionWallet
            const positionWallet = { [walletId]: wallet.private_key };

            // Save the updated trading info in Redis (overwrite the previous wallet)
            await setTradingInfo(userId, { ...tradingInfo, positionWallet });

            await positionsCommand(ctx);
        } else {
            await ctx.reply(`Wallet not found.`);
        }
    } catch (error) {
        console.error('Error handling wallet selection for position:', error.message);
        await ctx.reply('An error occurred while processing your request.');
    }
};
