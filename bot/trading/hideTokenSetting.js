import { getTradingInfo, setTradingInfo } from './utilsTrading/redisUtilsTrading.js';
import { positionsCommand } from './position.js';

export const hideTokenSetting = async (ctx) => {
    try {
        const userId = ctx.from.id; // Get the user ID from the context
        
        // Get current trading info from Redis
        const tradingInfo = await getTradingInfo(userId);

        // Determine the current value of hideToken
        const currentHideToken = tradingInfo.hideToken;

        // Update the hideToken flag in the trading info
        const updatedTradingInfo = {
            ...tradingInfo,
            hideToken: currentHideToken === 'true' ? 'false' : 'true' // Toggle the flag
        };

        // Save the updated trading info in Redis
        await setTradingInfo(userId, updatedTradingInfo);

        // Refresh the position display
        await positionsCommand(ctx);
    } catch (error) {
        console.error('Error updating hide token setting:', error.message);
        await ctx.reply('An error occurred while updating your token settings.');
    }
};
