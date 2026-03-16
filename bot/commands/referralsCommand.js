// commands/referralsCommand.js

import { urlRefPayout } from '../private/private.js';
import { fetchData } from '../utils/fetchData.js';

const escapeMarkdownV2 = (text) => {
    return text.replace(/[[\]()~>#+\-=|{}.!]/g, '\\$&');
};

const getConversionRateEmoji = (rate) => {
    if (rate >= 50) return '🥳';
    if (rate >= 20) return '🟢';
    if (rate >= 10) return '🟡';
    return '🟠';
};

export const referralsCommand = async (ctx) => {
    try {
        const userId = ctx.from.id;

        const data = await fetchData(`${urlRefPayout}/${userId}`);

        const {
            total_ref_payout_amount = 0,
            total_referred_users = 0,
            num_referred_users_made_claims = 0
        } = data || {};

        const totalEarnings = parseFloat(total_ref_payout_amount) || 0;
        const conversionRate = total_referred_users > 0
            ? (num_referred_users_made_claims / total_referred_users) * 100
            : 0;
        const conversionRateEmoji = getConversionRateEmoji(conversionRate);

        let responseMessage = `
💰 *You've earned ${totalEarnings.toFixed(4)} SOL* - *${conversionRateEmoji} ${conversionRate.toFixed(0)}% Conversion Rate*

Referred users: ${total_referred_users} - Claim count: ${num_referred_users_made_claims}
        `;

        responseMessage = escapeMarkdownV2(responseMessage);

        await ctx.reply(responseMessage, {
            parse_mode: 'MarkdownV2',
            reply_to_message_id: ctx.message.message_id
        });
    } catch (error) {
        console.error(`Error in referralsCommand for user ${ctx.from?.id}:`, error.message);
        await ctx.reply('We’re having trouble with your referral data. Please try again later.');
    }
};
