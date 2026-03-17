// buttons/menuButton.js

import { deleteMessages } from '../utils/deleteMessages.js';
import { fetchStats } from '../utils/fetchStats.js';
import { getUserStats } from '../utils/fetchUserStat.js';
import pTimeout from '../utils/pTimeout.js';

export const menuButton = async (ctx, deleteMessageId = null) => {
    const userId = ctx.from.id;

    try {
        // Fetch user data
        const [statsData, statsDataUser] = await Promise.all([fetchStats(), getUserStats(userId)]);
        const statsDataClaimedStr = statsData.claimed.toFixed(4).toString().replace('.', '\\.');
        const statsDataUserClaimedStr = statsDataUser.claimed.toFixed(4).toString().replace('.', '\\.');        
        const responseText = `🎉 Welcome to the SolClaim menu\\!\n\n` +

        `[Group](https://t.me/SolClaimChat) \\| [Channel](https://t.me/SolClaimPortal) \\| [Trending](https://t.me/solclaimtrending) \\| [Twitter](https://x.com/solclaimx)\n\n` +

        `📊 ${statsDataClaimedStr} SOL Total Claims\n💰 You have claimed ${statsDataUserClaimedStr} SOL\n\n` +

            'Connect your wallets and start claiming back your SOL for *free*\\. We also made a \\/tutorial of the bot\\.';

        const miniAppUrl = process.env.NEXT_PUBLIC_APP_URL;
        const INLINE_KEYBOARD = [
            ...(miniAppUrl ? [[{ text: '📱 Open Mini App', web_app: { url: miniAppUrl } }]] : []),
            [{ text: '🔎 Check wallet(s)', callback_data: 'check' }, { text: '💳 My wallets', callback_data: 'mywallets' }],
            [{ text: '💸 Invite and earn', callback_data: 'referral' }],
            [{ text: '⚙️ Settings', callback_data: 'settings' }],
            // [{ text: '⚙️ Settings', callback_data: 'settings' }, { text: '📊 Buy & Sell', callback_data: 'positions' }],
            // [{ text: '💰 SolClaim Bridge Bot', url: 'https://t.me/solclaimbridgebot' }],
            // [{ text: '🆕 Claim With Phantom', url: 'https://t.me/SolClaimPortal/276' }],
        ];
        
        if (ctx.callbackQuery && !deleteMessageId) {
            await ctx.editMessageText(responseText, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: INLINE_KEYBOARD,
                },
                disable_web_page_preview: true
            });
        } else if (ctx.callbackQuery && deleteMessageId) {
            await Promise.all([
                pTimeout(ctx.reply(responseText, {
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: INLINE_KEYBOARD,
                    },
                    disable_web_page_preview: true
                }), { milliseconds: 10000 }),
                deleteMessages(ctx, [deleteMessageId]),
            ]);
        } else if (ctx.message) {
            // Sending a new message
            await ctx.reply(responseText, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: INLINE_KEYBOARD,
                },
                disable_web_page_preview: true
            });
        }
    } catch (error) {
        console.error('Error menu Button:', error.message);
        await ctx.reply('Failed to fetch menu data. Please try again later.');
    }
};



