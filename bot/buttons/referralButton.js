// buttons/referralButton.js

import { fetchDataReferral } from '../utils/fetchDataReferral.js';
import { urlRefPayout } from '../private/private.js';

const getConversionRateEmoji = (rate) => {
    if (rate >= 50) return '🥳';
    if (rate >= 20) return '🟢';
    if (rate >= 10) return '🟡';
    return '🟠';
};

export const referralButton = async (ctx) => {
    const userId = ctx.from.id;
    const referralLink = `https://t\\.me/solclaimxbot?start\\=${userId}`;
    try {
        await ctx.answerCbQuery?.();
        // Fetch user's referral earnings and total affiliates earnings
        const userEarningsResponse = await fetchDataReferral(`${urlRefPayout}/${userId}`);

        // Extract values using destructuring and provide default values
        const {
            total_ref_payout_amount: userEarnings = 0,
            total_referred_users: totalReferredUsers = 0,
            num_referred_users_made_claims: userClaimed = 0,
            commission_percentage: commissionPercentage = 25
        } = userEarningsResponse || {};

        // Ensure userEarnings is a number
        const userEarningsNum = parseFloat(userEarnings) || 0;
        const userEarningsStr = userEarningsNum.toFixed(4).replace('.', '\\.');

        // Calculate the conversion rate
        const conversionRate = totalReferredUsers > 0
            ? (userClaimed / totalReferredUsers) * 100
            : 0;
        const conversionRateEmoji = getConversionRateEmoji(conversionRate);

        // Format the conversion rate
        const conversionRateStr = totalReferredUsers > 0
            ? `${conversionRateEmoji} Your conversion rate: ${conversionRate.toFixed(0)}%`
            : '🔴 No referrals recorded yet';

        // Update the response with fetched data
        const response = `Get ${commissionPercentage}% profit share by sharing your link with your community\\!

💰 Your earnings: ${userEarningsStr} SOL
🤝 \\# of referred users: ${totalReferredUsers}
💸 \\# of users claimed: ${userClaimed}
${conversionRateStr}

*Data updated every 30 minutes\\.*

_Every time a user that was referred by you makes a claim\\, you will get ${commissionPercentage}% profit share\\. We'll send it instantly to the wallet set in your_ \\/settings\\.

*__Your Referral Link__*

Bot \\(telegram\\):
\`${referralLink}\``;

        const shareText = `
Claim FREE Sol With SolClaim!

💰 Free SOL for every trader
🆕 First SOL trader rewards bot
🔐 Secure and safe (approved by Phantom)

👉 Start getting free SOL with SolClaim today.`;

        const encodedText = encodeURIComponent(shareText);
        const shareUrl = `https://t.me/share/url?url=t.me/solclaimxbot?start=${userId}&text=${encodedText}`;

        await ctx.editMessageText(response, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💬 Share with friends', url: shareUrl}],
                    [{ text: '← Back', callback_data: 'menu' }]
                ],
            },
        });
    } catch (error) {
        console.error('Error fetching referral data:', error.message);
        await ctx.answerCbQuery?.().catch(() => {});
        await ctx.reply('We\'re having trouble loading your referral data. Please try again later.').catch(() => {});
    }
};


