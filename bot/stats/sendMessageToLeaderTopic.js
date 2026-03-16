// stats/sendMessageToLeaderTopic.js
import { Telegraf } from 'telegraf';
import { apiTelegram, groupChatId, claimTopics } from '../private/private.js';

// Use your bot token here
const botsend = new Telegraf(apiTelegram);

export const sendMessageToLeaderTopic = async (ctx, message) => {
    try {
        await botsend.telegram.sendMessage(groupChatId, message, {
            message_thread_id: claimTopics
        });
    } catch (error) {
        console.error('Failed to send message to group:', error);
    }
};

export default sendMessageToLeaderTopic;

// const message = 'hello';
// await sendMessageToLeaderTopic(null, message);
