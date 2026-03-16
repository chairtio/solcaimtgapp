
export const airdropCommand = async (ctx) => {

    const responseText = `
https://t.me/solclaim/353.
    `;

    try {
        await ctx.reply(responseText, {
            reply_to_message_id: ctx.message.message_id
        });
    } catch (error) {
        console.error('Error airdrop Command:', error.message);
    }
};
