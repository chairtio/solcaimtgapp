// commands/trading/buyMode.js

import { getTradingInfo } from './utilsTrading/redisUtilsTrading.js';
import { deleteMessages } from '../utils/deleteMessages.js';
import pTimeout from '../utils/pTimeout.js';
import { deleteMessageId } from '../utils/redisUtils.js';
import { fetchData } from '../utils/fetchData.js';
import { urlTelegramWallets } from '../private/private.js';
import { buyButtons } from './utilsTrading/button.js';

export const buyMode = async (ctx, options = {}) => {
    try {
        const userId = ctx.from.id;

        // Get fee and slippage from tradingInfo
        const tradingInfo = await getTradingInfo(userId);
        const fee = tradingInfo.fee || 0.00001;
        const slippage = tradingInfo.slippage || 3;

        // Fetch wallet info from your API
        const wallets = await fetchData(`${urlTelegramWallets}?telegram_id=${userId}`);

        // Determine the mint address
        const mintAddressStr = options.mintAddressStr || (ctx.callbackQuery?.data.split(':')[1] || '');

        // Get all wallet settings from Redis
        const allWallets = tradingInfo.wallets || {}; // Default to empty object if not set

        const isSelected = value => (fee === value ? '✅ ' : '');

        // Prepare inline keyboard buttons
        const keyboard = [
            [{ text: 'Buy Mode ✅', callback_data: `buyMode:${mintAddressStr}` }, { text: 'Sell Mode ❌', callback_data: `sellMode:${mintAddressStr}` }],
            [{ text: `${isSelected(0.0005)} Fast 🐴`, callback_data: `feeBuy0_0005:${mintAddressStr}` }, { text: `${isSelected(0.001)} Turbo 🚀`, callback_data: `feeBuy0_001:${mintAddressStr}` }, { text: `${isSelected(0.005)} Ultra ⚡`, callback_data: `feeBuy0_005:${mintAddressStr}` }],
            [{ text: `${![0.0005, 0.001, 0.005].includes(fee) ? '✅ ' : ''} ⛽️ Gas: ${fee} SOL (Custom)`, callback_data: `feeBuyCustom:${mintAddressStr}` }, { text: `✏️ Slippage: ${slippage}%`, callback_data: `slippageBuy:${mintAddressStr}` }],
        ];

        if (wallets && wallets.length > 0) {
            const limitedWallets = wallets.slice(0, 5); // Limit to the first 5 wallets
            let selectedWalletsCount = 0;

            for (let i = 0; i < limitedWallets.length; i += 2) {
                const row = [];
                const wallet1 = limitedWallets[i];
                const truncatedPublicKey1 = `${wallet1.public_key.substring(0, 4)}...`;
                const isSelected1 = allWallets[wallet1.id] ? ' ✅' : '';
                if (isSelected1) selectedWalletsCount++;
                const walletButton1 = { 
                    text: `Wallet ${i + 1}: ${truncatedPublicKey1}${isSelected1}`, 
                    callback_data: `walletB:${wallet1.id}:${mintAddressStr}` 
                };
                row.push(walletButton1);
        
                if (limitedWallets[i + 1]) {
                    const wallet2 = limitedWallets[i + 1];
                    const truncatedPublicKey2 = `${wallet2.public_key.substring(0, 4)}...`;
                    const isSelected2 = allWallets[wallet2.id] ? ' ✅' : '';
                    if (isSelected2) selectedWalletsCount++;
                    const walletButton2 = { 
                        text: `Wallet ${i + 2}: ${truncatedPublicKey2}${isSelected2}`, 
                        callback_data: `walletB:${wallet2.id}:${mintAddressStr}` 
                    };
                    row.push(walletButton2);
                }
        
                keyboard.push(row);
            }

            // Determine the text and callback data for the select/unselect button
            const selectButtonText = selectedWalletsCount === limitedWallets.length ? '💳 Unselect All' : '💳 Select All';
            const selectButtonCallback = selectedWalletsCount === limitedWallets.length ? `unselectWalletsB:${mintAddressStr}` : `selectWalletsB:${mintAddressStr}`;

            const selectButton = { 
                text: selectButtonText, 
                callback_data: selectButtonCallback 
            };

            if (limitedWallets.length % 2 !== 0) {
                keyboard[keyboard.length - 1].push(selectButton);
            } else {
                keyboard.push([selectButton]);
            }
        }

        // Add Wallet Settings button only if no wallets are connected
        if (wallets.length === 0) {
            keyboard.push([{ text: '⚙️ Wallet Settings', callback_data: 'mywalletsReply' }]);
        }

        keyboard.push(...buyButtons(mintAddressStr));

        const messageId = options.editMessageTradeId || ctx.callbackQuery?.message?.message_id;

        if (!messageId) {
            console.error('Message ID could not be determined for editing in Buy mode.');
            return;
        }

        const editPromise = pTimeout(ctx.telegram.editMessageReplyMarkup(
            ctx.chat.id,
            messageId,
            undefined,
            {
                inline_keyboard: keyboard,
            }
        ), 10000);
        
        if (options.currentMessageId && options.originalMessageId) {
            const deleteMessagesPromise = deleteMessages(ctx, [options.currentMessageId, options.originalMessageId]);
            await Promise.all([editPromise, deleteMessagesPromise]);
        } else {
            await editPromise;
        }
        deleteMessageId(userId, 'trade');
        
    } catch (error) {
        if (!error.message.includes('specified new message content and reply markup are exactly the same as a current content and reply markup of the message')) {
            console.error('Error updating to Buy Mode:', error.message);
        }
    }
};
