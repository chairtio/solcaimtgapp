// commands/settingsCommand.js
export const settingsCommand = async (ctx) => {
    const response = `Update your settings here:`;

    try {
        await ctx.reply(response, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💳 View/change withdrawal address', callback_data: 'viewchange' }],
                    [{ text: '← Back', callback_data: 'menu' }],
                ],
            },
        });
    } catch (error) {
        console.error('Error sending settings message:', error.message);
    }
};