import { setTradingInfo, getTradingInfo } from "./utilsTrading/redisUtilsTrading.js";
import { deleteMessages } from '../utils/deleteMessages.js';
import pTimeout from '../utils/pTimeout.js';
import { sellMode } from './sellMode.js'

const MIN_SLIPPAGE = 0.3; // Minimum allowed slippage value in percentage
const MAX_SLIPPAGE = 10;  // Maximum allowed slippage value in percentage

// Function to handle setting a new slippage
export async function slippageSellSetting(ctx, editMessageTradeId, mintAddressStr) {
    try {
        const userId = ctx.from.id;
        const originalMessageId = ctx.message.reply_to_message.message_id;
        const currentMessageId = ctx.message.message_id; // Store the message ID in a constant
        const slippageInput = ctx.message.text.trim(); // Get and trim the user input
        const parsedSlippage = parseFloat(slippageInput);

        // Check if parsedSlippage is a valid number and greater than zero
        if (isNaN(parsedSlippage) || parsedSlippage < 0) {
            const replyPromise = pTimeout(ctx.reply('❌ Invalid slippage value.'), 10000);
            const deleteMessagesPromise = deleteMessages(ctx, [currentMessageId, originalMessageId]);
            await Promise.all([replyPromise, deleteMessagesPromise]);

            return;
        }

        const finalSlippage = Math.max(MIN_SLIPPAGE, Math.min(parsedSlippage, MAX_SLIPPAGE));

        // Retrieve the current trading info from Redis
        const tradingInfo = await getTradingInfo(userId);
        const { slippage } = tradingInfo;

        // Check if the new slippage value is the same as the current one
        if (finalSlippage === slippage) {
            await deleteMessages(ctx, [currentMessageId, originalMessageId]);
            // await ctx.reply(`Slippage is already set to ${finalSlippage}%. No changes were made.`);
            return;
        }

        // Save the new slippage in Redis
        await setTradingInfo(userId, { ...tradingInfo, slippage: finalSlippage });
        // Edit the inline keyboard with the updated slippage
        await sellMode(ctx, { editMessageTradeId, mintAddressStr, currentMessageId, originalMessageId });
    } catch (error) {
        console.error('Error setting slippage:', error.message);
        await ctx.reply('An error occurred while setting the slippage. Please try again later.');
    }
}
