// commands/leadersRefCommand.js

import { fetchData } from '../utils/fetchData.js';
import { urlLeaderboardRef } from '../private/private.js';

// Escape special MarkdownV2 characters
const escapeMarkdownV2 = (text) => {
    return text.replace(/[[\]()~>#+\-=|{}.!]/g, '\\$&');
};

const abbreviateUserId = (userId) => {
    const strId = String(userId);
    if (strId.length <= 6) {
        return strId;
    }
    return `${strId.slice(0, 3)}...${strId.slice(-3)}`;
};

const getRankEmoji = (rank) => {
    switch(rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return `${rank}`;
    }
};

export const leadersRefCommand = async (ctx) => {
    try {
        const leaderboardData = await fetchData(urlLeaderboardRef);

        let leaderboardText = '*Top 10 affiliates:*\n\n*No*\\|       *User*       \\|  *Count*  \\|  *Earnings*\n';

        leaderboardData.slice(0, 10).forEach((user, index) => {
            const abbreviatedUserId = abbreviateUserId(user.telegram_id);
            const escapedAbbreviatedUserId = escapeMarkdownV2(abbreviatedUserId);
            const rank = index + 1;

            const rankText = escapeMarkdownV2(`${getRankEmoji(rank)}`).padEnd(5, ' ');
            const userText = `[${escapedAbbreviatedUserId}](tg://user?id=${user.telegram_id})`.padEnd(46, ' ');
            const referredUsersText = escapeMarkdownV2(String(user.num_referred_users)).padEnd(8, ' ');
            const earningsText = escapeMarkdownV2(parseFloat(user.total_ref_payout_amount).toFixed(4)).padStart(0, ' ');

            leaderboardText += `${rankText} ${userText} ${referredUsersText} ${earningsText} SOL\n`;
        });

        let responseText = `${leaderboardText}\n`;

        await ctx.reply(responseText, {
            parse_mode: 'MarkdownV2',
            reply_to_message_id: ctx.message.message_id
        });
    } catch (error) {
        console.error('Error leaders Ref Command:', error.message);
        await ctx.reply('We’re having trouble fetching the leaderboard. Please try again later.');
    }
};
