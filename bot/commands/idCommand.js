export const idCommand = async (ctx) => {
    try {
        const userId = ctx.from.id;
        const chatId = ctx.chat.id;
        let responseText;

        // Check if userId and chatId are the same
        if (userId === chatId) {
            responseText = `Your Telegram Unique ID: \`${userId}\``;
        } else {
            responseText = `Your Telegram Unique ID: \`${userId}\`\nYour Chat ID: \`${chatId}\``;
        }

        await ctx.reply(responseText, {
            parse_mode: 'MarkdownV2',
            reply_to_message_id: ctx.message.message_id
        });
    } catch (error) {
        console.error('Error id Command:', error.message);
    }
};
