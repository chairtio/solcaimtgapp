import { deleteMessages } from "../utils/deleteMessages.js";

export async function closeMessage(ctx, messageId) {
    try {
        await deleteMessages(ctx, [messageId]);
    } catch (error) {
        console.error('Error closeMessage:', error.message);
    }
};
