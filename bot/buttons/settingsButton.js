// buttons/settingsButton.js
export const settingsButton = async (ctx) => {
    const response = `Update your settings here:`;
    
    try {
        await ctx.editMessageText(response, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💳 View/change withdrawal address', callback_data: 'viewchange' }],
                    [{ text: '← Back', callback_data: 'menu' }],
                ],
            },
        });
    } catch (error) {
        console.error('Error editing settings message:', error.message);
    }
};