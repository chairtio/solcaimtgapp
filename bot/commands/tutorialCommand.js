// commands/tutorialCommand.js

export const tutorialCommand = async (ctx) => {

    const responseText = `https://t.me/SolClaimPortal/149`;

    try {
        await ctx.reply(responseText, {
            reply_to_message_id: ctx.message.message_id
        });
    } catch (error) {
        console.error('Error tutorial Command:', error.message);
    }
};