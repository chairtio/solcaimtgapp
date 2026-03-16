// utils/telegramUtils.js
import { sendMessageAirdropProcess } from '../airdropSolclaim/sendMessageAirdroprequested.js';
import { bot } from '../private/private.js';
import { abbreviateUserId } from '../utils/escapeMarkdownV2.js';

export const sendToTelegramGroup = async (airdropRequest) => {
    try {
        // Validate input
        if (!airdropRequest || !airdropRequest.telegram_user_id || !airdropRequest.amount) {
            console.error("Missing required parameters in airdrop_request.");
            return null; // Return null for invalid request
        }

        const {
            id,
            created_at,
            airdrop_id,
            telegram_user_id,
            amount,
            processed,
            _telegram_user,
            diamonds
        } = airdropRequest;

        // Determine the username or fallback to Telegram user ID
        let username;
        if (_telegram_user.username && _telegram_user.username.trim() !== '') {
            username = _telegram_user.username;
        } else {
            username = abbreviateUserId(_telegram_user.telegram_id); // Use telegram_user_id if username is null or empty
        }

        // Create the message to send to the Telegram group
        const message = `🟠 [@${username}](tg://user?id=${_telegram_user.telegram_id}) requested to swap ${diamonds} 💎 for ${amount} $SCLAIM`;

        // Send message to the specified Telegram group
        await sendMessageAirdropProcess(bot, message); // Replace with your group ID
        return true; // Return true on success
    } catch (error) {
        console.error("Error sending message to Telegram group:", error.message);
        return null; // Return null on error
    }
};
