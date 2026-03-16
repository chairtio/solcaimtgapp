// utils/sendMessageToGroup.js
import { Telegraf } from 'telegraf';
import { apiTelegram, groupChatId } from '../private/private.js';

// Use your bot token here
const botsend = new Telegraf(apiTelegram);

export const sendMessageToGroup = async (ctx, message) => {
    try {
        await botsend.telegram.sendMessage(groupChatId, message);
    } catch (error) {
        console.error('Failed to send message to group:', error.message);
    }
};

export default sendMessageToGroup;
