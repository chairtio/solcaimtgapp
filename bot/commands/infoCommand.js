// commands/infoCommand.js

export const infoCommand = async (ctx) => {

    const responseText = `
Read this for an explanation on how the bot works:
https://t.me/SolClaimPortal/162.
    `;

    try {
        await ctx.reply(responseText, {
            reply_to_message_id: ctx.message.message_id
        });
    } catch (error) {
        console.error('Error info Command:', error.message);
    }
};