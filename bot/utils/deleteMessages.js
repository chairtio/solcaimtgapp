// utils/deleteMessages.js
import pTimeout from './pTimeout.js';

const TIMEOUT_DURATION = 10000; // 10s

/**
 * Deletes multiple messages from a chat with a timeout.
 * @param {Object} ctx - The context object from Telegraf.
 * @param {Array} messageIds - An array of message IDs to delete.
 * @param {number} [timeout=TIMEOUT_DURATION] - Optional timeout duration in milliseconds.
 * @returns {Promise<void>}
 */
export async function deleteMessages(ctx, messageIds, timeout = TIMEOUT_DURATION) {
    const deletePromises = messageIds.map(messageId =>
        pTimeout(ctx.telegram.deleteMessage(ctx.chat.id, messageId), timeout)
    );

    try {
        await Promise.all(deletePromises);
    } catch (error) {
        console.error('Error during message deletion deleteMessage.js:', error.message);
    }
}
