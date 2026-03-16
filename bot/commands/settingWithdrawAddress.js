// commands/settingWithdrawAddress.js
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { fetchData } from '../utils/fetchData.js';
import { urlTelegramUser } from '../private/private.js';
import { deleteMessages } from '../utils/deleteMessages.js';
import pTimeout from '../utils/pTimeout.js';

export const settingWithdrawAddress = async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username;
    const originalMessageId = ctx.message.reply_to_message.message_id;
    const publicKeyInput = ctx.message.text.trim();
    try {
        // Decode the base58 encoded public key
        const decodedPublicKey = bs58.decode(publicKeyInput);

        // Check if the decoded public key has a valid length
        if (decodedPublicKey.length !== 32) {
            const replyPromise = pTimeout(ctx.reply('⚠️ Invalid address, try again.\n\nReply with your withdrawal address:', {
                reply_markup: {
                    force_reply: true,
                },
            }), 10000);
            const deleteMessagesPromise = deleteMessages(ctx, [ctx.message.message_id, originalMessageId]);
            await Promise.all([replyPromise, deleteMessagesPromise]);

            return;
        }

        // Create a PublicKey instance from the decoded bytes
        const userPublicKey = new PublicKey(decodedPublicKey);

        // Update withdrawal address in Supabase
        const patchUrl = `${urlTelegramUser}/${userId}`;
        try {
            await fetchData(patchUrl, 'PATCH', {
                username: username,
                withdrawal_wallet: userPublicKey.toBase58()
            });

            const responseTextTG = `✅ Your withdrawal address: (${userPublicKey.toBase58().substring(0, 4)}...) has been saved! You can update it in /settings any time.\n\nAlso, ensure your withdraw wallet balance > 0.0025 SOL\n\nTo see all the options go to the /menu or just check if a wallet is eligible to claim SOL:`;
            await ctx.reply(responseTextTG, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔎 Check wallet(s)', callback_data: 'check' }],
                        [{ text: '← Back', callback_data: 'viewchange' }],
                        [{ text: '☰ Menu', callback_data: 'menu' }]
                    ],
                },
            });
            await deleteMessages(ctx, [ctx.message.message_id, originalMessageId]);
        } catch (updateError) {
            console.error('Failed to save the address:', updateError.message);
            await ctx.reply('Failed to save the address. Please try again.');
        }

    } catch (error) {
        console.error('Error settings withdraw address:', error.message);
        const replyPromise = pTimeout(ctx.reply('⚠️ Invalid address, try again.\n\nReply with your withdrawal address:', {
            reply_markup: {
                force_reply: true,
            },
        }), 10000);
        const deleteMessagesPromise = deleteMessages(ctx, [ctx.message.message_id, originalMessageId]);
        await Promise.all([replyPromise, deleteMessagesPromise]);
    }
};
