import { fetchData } from '../utils/fetchData.js';
import { urlLeaderboard, urlTotalStats, groupChatId } from '../private/private.js';
import { Telegraf } from 'telegraf';
import { apiTelegram } from '../private/private.js';
import { escapeMarkdownV2 } from '../utils/escapeMarkdownV2.js';

// Create your bot instance
const botupdate = new Telegraf(apiTelegram);

// Function to abbreviate user IDs
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

export const updateLeaderboardMessage = async () => {
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
                userText = '[Web User](http://app.solclaim.io/)';
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

        let responseText = `*SolClaim Stats & Leaderboard*

📊 Total Claimed: ${totalClaimed} SOL
🤝 Total Users: ${totalUsers} Users

${leaderboardText}\n`;

        await botupdate.telegram.editMessageText(
            groupChatId,
            271034, // The message ID to edit
            undefined,
            responseText,
            { parse_mode: 'MarkdownV2' }
        );
    } catch (error) {
        console.error('Failed to update leaderboard message', error.message);
    }
};

// // Call the function to update the leaderboard message
// updateLeaderboardMessage();

