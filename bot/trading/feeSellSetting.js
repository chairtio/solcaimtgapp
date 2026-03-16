import { setTradingInfo, getTradingInfo } from "./utilsTrading/redisUtilsTrading.js";
import { deleteMessages } from '../utils/deleteMessages.js';
import pTimeout from '../utils/pTimeout.js';
import { sellMode } from './sellMode.js'

const MIN_FEE = 0.00001;
const MAX_FEE = 0.1;

// Function to handle setting a new fee
export async function feeSellSetting(ctx, { editMessageTradeId, mintAddressStr, amount = null } = {}) {
    try {
        const userId = ctx.from.id;
        const originalMessageId = ctx.message?.reply_to_message?.message_id;
        const currentMessageId = ctx.message?.message_id;
        let parsedFee;
        if (amount === null) {
            const feeInput = ctx.message?.text?.trim(); // Get and trim the user input
            parsedFee = parseFloat(feeInput)
        } else {
            parsedFee = amount;
        }

        // Check if parsedFee is a valid number and within the allowed range
        if (isNaN(parsedFee) || parsedFee < 0) {
            if (currentMessageId) {
                const replyPromise = pTimeout(ctx.reply('❌ Invalid fee value.'), 10000);
                const deleteMessagesPromise = deleteMessages(ctx, [currentMessageId, originalMessageId]);
                await Promise.all([replyPromise, deleteMessagesPromise]);
            }
            return;
        }

        // Apply minimum and maximum fee logic
        const finalFee = Math.min(Math.max(parsedFee, MIN_FEE), MAX_FEE);

        // Retrieve the current trading info from Redis
        const tradingInfo = await getTradingInfo(userId);
        const { fee } = tradingInfo;

        if (finalFee === fee) {
            if (currentMessageId) {
                await deleteMessages(ctx, [currentMessageId, originalMessageId]);
            }
            return;
        }

        // Save the new fee in Redis
        await setTradingInfo(userId, { ...tradingInfo, fee: finalFee });
        await sellMode(ctx, { editMessageTradeId, mintAddressStr, currentMessageId, originalMessageId });
    } catch (error) {
        console.error('Error setting fee sell setting:', error.message);
        await ctx.reply('Error setting the fee. Please try again later.');
    }
}
