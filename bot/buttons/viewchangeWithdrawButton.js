// buttons/viewchangeWithdrawButton.js
import { getUserWithdrawWallet } from '../utils/getUserWithdrawWallet.js';

export const viewchangeWithdrawButton = async (ctx) => {
    const userId = ctx.from.id;

    try {
        const userWithdrawWallet = await getUserWithdrawWallet(userId);

        let responseText = '';

        if (userWithdrawWallet) {
            const userPublicKey = userWithdrawWallet.toBase58();
            responseText += `This is your current withdrawal address:\n\`${userPublicKey}\`\n\n*Also\\, ensure your withdraw wallet balance \\> 0\\.0025 SOL*`;
            // console.log('User withdrawal address:', userPublicKey);

            // Respond to the user with inline buttons
            await ctx.editMessageText(responseText, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Update withdrawal address', callback_data: 'settingWithdrawAddress' }],
                        // [{ text: '← Back', callback_data: 'settings' }],
                        [{ text: '☰ Menu', callback_data: 'menu' }]
                    ],
                },
            });
        } else {
            responseText += `No withdrawal address found\\. Please set your withdrawal address by clicking below\\.\n\nAlso\\, ensure your withdraw wallet balance \\> 0\\.0025 SOL`;
            console.log('No withdrawal address found for user:', userId);

            // Respond to the user with inline buttons
            await ctx.editMessageText(responseText, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Set withdrawal address', callback_data: 'settingWithdrawAddress' }],
                        [{ text: '⚙️ Back to settings', callback_data: 'settings' }],
                        [{ text: '🏠 Back to menu', callback_data: 'menu' }]
                    ],
                },
            });
        }
    } catch (error) {
        console.error('Error view/change Withdraw Button:', error.message);
        await ctx.reply('Failed to retrieve your settings. Please try again later.');
    }
};
