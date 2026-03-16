// buttons/burntokensButton.js
export const burntokensButton = async (ctx) => {
    try {
        const response = `To claim all eligible SOL you need to burn remaining tokens in your wallet. Use this function with caution, make sure you don’t have any tokens you still want to keep in your connected wallets.`;

        await ctx.editMessageText(response, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⚠️ Proceed with burning', callback_data: 'burn' }],
                    [{ text: '← Back', callback_data: 'mywallets' }, { text: '☰ Menu', callback_data: 'menu' }]
                ],
            },
        });
    } catch (error) {
        console.error('Error editing message:', error.message);
    }
};