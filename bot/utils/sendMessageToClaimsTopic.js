// utils/sendMessageToGroup.js
import { bot, groupChatId, claimTopics } from '../private/private.js';

export const sendMessageToClaimsTopic = async (ctx, message) => {
    try {
        await bot.telegram.sendMessage(groupChatId, message, {
            message_thread_id: claimTopics,
            parse_mode: 'MarkdownV2'
        });
    } catch (error) {
        console.error('Failed to send message to Claims Topic:', error.message);
    }
};

export default sendMessageToClaimsTopic;
