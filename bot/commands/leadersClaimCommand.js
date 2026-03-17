import { fetchData } from '../utils/fetchData.js';
import { urlLeaderboard, urlTotalStats } from '../private/private.js';
import { escapeMarkdownV2 } from '../utils/escapeMarkdownV2.js';

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

export const leadersClaimCommand = async (ctx) => {
    try {
        const totalStats = await fetchData(urlTotalStats);
        const leaderboardData = await fetchData(urlLeaderboard);

        const totalClaimed = escapeMarkdownV2(parseFloat(totalStats.claimed).toFixed(4));
        const totalUsers = totalStats.users;

        let leaderboardText = '*Top 20 largest claims:*\n*No*  \\|        *User*        \\|  *Claim Amount*\n';
        leaderboardData.slice(0, 20).forEach((user, index) => {
            let userText;
            if (user.telegram_id === 0) {
                // For users with telegram_id == 0
                userText = 'Web User';
            } else {
                // For users with a valid telegram_id
                const abbreviatedUserId = abbreviateUserId(user.telegram_id);
                const escapedAbbreviatedUserId = escapeMarkdownV2(abbreviatedUserId);
                userText = `[${escapedAbbreviatedUserId}](tg://user?id=${user.telegram_id})`;
            }
            const rank = index + 1;
            const rankEmoji = escapeMarkdownV2(getRankEmoji(rank));

            leaderboardText += `${rankEmoji}         ${userText}          ${escapeMarkdownV2(parseFloat(user.total_claim_amount).toFixed(4))} SOL\n`;
        });

        let responseText = `*SolClaim Stats & Leaderboard*\n\n📊 Total Claimed: ${totalClaimed} SOL\n🤝 Total Users: ${totalUsers} Users\n\n${leaderboardText}\n`;

        await ctx.reply(responseText, {
            parse_mode: 'MarkdownV2',
            reply_to_message_id: ctx.message.message_id
        });
    } catch (error) {
        console.error('Error leaders Claim Command:', error.message);
        await ctx.reply('We’re having trouble fetching the leaderboard. Please try again later.');
    }
};
