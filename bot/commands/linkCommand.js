// commands/linkCommand.js
import { urlTelegramUser } from '../private/private.js';
import { fetchData } from '../utils/fetchData.js';

const escapeMarkdownV2 = (text) => {
    return text.replace(/[[\]()~>#+\-=|{}.!]/g, '\\$&');
};
export const linkCommand = async (ctx) => {
    try {
        const userId = ctx.from.id;
        const username = ctx.from.username;

        // Check if the user exists in the database
        let userResponse;
        try {
            userResponse = await fetchData(`${urlTelegramUser}/${userId}`);
            console.log(`User data fetched link: ${JSON.stringify(userResponse)}`);
        } catch (error) {
            console.log(`User not found, creating new user with ID link: ${userId}`);
            // If the user does not exist, create a new user
            userResponse = await fetchData(urlTelegramUser, 'POST', { telegram_id: userId, username: username });
            console.log(`User data fetched after creation link: ${JSON.stringify(userResponse)}`);
        }

        // Generate the referral link
        const referralLink = `https://t.me/solclaimxbot?start=${userId}`;

        // Send the referral link to the user
        const responseText = `*__Your Referral Link__*\n\`${referralLink}\``;
        const escapedMessage = escapeMarkdownV2(responseText);

        await ctx.reply(escapedMessage, {
            parse_mode: 'MarkdownV2',
            reply_to_message_id: ctx.message.message_id
        });

    } catch (error) {
        console.error('Error link Command', error.message);
        await ctx.reply('Failed to generate referral link. Please try again later.');
    }
};
