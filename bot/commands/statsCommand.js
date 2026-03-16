// commands/stats.js
import { fetchStats } from '../utils/fetchStats.js';
import { getUserStats } from '../utils/fetchUserStat.js';

export const statsCommand = async (ctx) => {
    try {
        const userId = ctx.from.id;

        // Fetch stats data and user stats
        const [statsData, userStats] = await Promise.all([fetchStats(), getUserStats(userId)]);
        const totalUsers = statsData.users;
        const totalSOLClaimed = statsData.claimed.toFixed(4);
        const userSOLClaimed = userStats.claimed.toFixed(4);

        // Create the response text
        const responseText = `📊 Total SOL claimed by ${totalUsers} users: ${totalSOLClaimed} SOL\n📊 Total SOL claimed by you: ${userSOLClaimed} SOL`;

        // Send the final message
        await ctx.reply(responseText, {
            reply_to_message_id: ctx.message.message_id
        });
    } catch (error) {
        console.error('Error in statsCommand', error.message);
        await ctx.reply('Failed to fetch stats. Please try again later.');
    }
};
