import { AirdropTopics, groupChatId } from "../private/private.js";

export const sendMessageAirdropProcess = async (bot, message) => {
    try {
        await bot.telegram.sendMessage(groupChatId, message, {
            message_thread_id: AirdropTopics,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Failed to send message to Airdrop Topic:', error.message);
    }
};
