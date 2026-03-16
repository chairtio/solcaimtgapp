// storeMap/checkButton.js
import { PublicKey } from "@solana/web3.js";
import { checkClaim, getTokenData, clearTokenData } from './checkClaim.js';
import { SOL_CLAIM_PER_TOKEN_ACCOUNT } from '../private/private.js';
import { deleteMessages } from '../utils/deleteMessages.js';
import pTimeout from '../utils/pTimeout.js';

const TIMEOUT_MS = 60000;
const BATCH_SIZE = 10;

const blacklist = [
    "ZG98FUCjb8mJ824Gbs6RsgVmr1FhXb2oNiJHa2dwmPd",
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL",
    // Add more blacklisted addresses here
];

export async function checkButton(ctx) {
    const originalMessageId = ctx.message.reply_to_message.message_id;
    let progressMessage;

    try {
        const input = ctx.message.text.trim().split('\n');

        if (input.length > 20) {
            const deleteMessagesPromise = deleteMessages(ctx, [ctx.message.message_id, originalMessageId]);
            const replyPromise = pTimeout(ctx.reply('You can only input up to 20 addresses at a time.\n\nPaste up to 20 wallet addresses, each on a single line to check (not private keys):', {
                reply_markup: {
                    force_reply: true,
                },
            }), 10000);
            await Promise.all([deleteMessagesPromise, replyPromise]);
            return;
        }

        const validInput = [];
        for (const address of input) {
            const trimmedAddress = address.trim();
            try {
                new PublicKey(trimmedAddress); // Validate address
                if (!blacklist.includes(trimmedAddress)) {
                    validInput.push(trimmedAddress);
                }
            } catch (error) {
                const deleteMessagesPromise = deleteMessages(ctx, [ctx.message.message_id, originalMessageId]);
                const replyPromise = pTimeout(ctx.reply('⚠️ Invalid address, try again.\n\nPaste up to 20 wallet addresses, each on a single line to check (not private keys):', {
                    reply_markup: {
                        force_reply: true,
                    },
                }), 10000);
                await Promise.all([deleteMessagesPromise, replyPromise]);
                return;
            }
        }

        if (validInput.length === 0) {
            const deleteMessagesPromise = deleteMessages(ctx, [ctx.message.message_id, originalMessageId]);
            const replyPromise = pTimeout(ctx.reply('No valid addresses to check.\n\nPaste up to 20 wallet addresses, each on a single line to check (not private keys):', {
                reply_markup: {
                    force_reply: true,
                },
            }), 10000);
            await Promise.all([deleteMessagesPromise, replyPromise]);
            return;
        }

        const userId = ctx.from.id;
        const results = [];
        const walletBatches = [];
        for (let i = 0; i < validInput.length; i += BATCH_SIZE) {
            walletBatches.push(validInput.slice(i, i + BATCH_SIZE));
        }

        const totalWallets = validInput.length;
        let checkedWallets = 0;
        const startTime = Date.now();

        const progressPromise = pTimeout(ctx.reply(`🟠 Checking 0/${totalWallets} wallets...`), 10000)
            .then(msg => progressMessage = msg);

        const deleteMessagesPromise = deleteMessages(ctx, [ctx.message.message_id, originalMessageId]);

        await Promise.all([progressPromise, deleteMessagesPromise]);
        
        const messageId = progressMessage.message_id;

        for (const batch of walletBatches) {
            const timeSpent = Date.now() - startTime;
            const remainingTime = TIMEOUT_MS - timeSpent;
            const timeoutPerBatch = Math.max(remainingTime / (walletBatches.length - walletBatches.indexOf(batch)), 1000);

            const batchResults = await Promise.all(batch.map(async (address) => {
                const trimmedAddress = address.trim();

                try {
                    await pTimeout(checkClaim(trimmedAddress, userId), timeoutPerBatch);
                    const { tokenAccounts, zeroAmountAccountsCount } = await getTokenData(userId);

                    const solToClaim = tokenAccounts.length * SOL_CLAIM_PER_TOKEN_ACCOUNT;
                    const solAbleToClaim = zeroAmountAccountsCount * SOL_CLAIM_PER_TOKEN_ACCOUNT;

                    return {
                        address: trimmedAddress,
                        solToClaim: solToClaim.toFixed(4),
                        solAbleToClaim: solAbleToClaim.toFixed(4),
                    };

                } catch (error) {
                    if (error.message === 'Operation timed out') {
                        console.error('Timeout error processing address:', trimmedAddress);
                        return { address: trimmedAddress, error: 'Check timed out' };
                    } else {
                        console.error('Error processing address:', trimmedAddress, error.message);
                        return { address: trimmedAddress, error: 'Error processing address' };
                    }
                } finally {
                    checkedWallets++;
                    await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, `🟠 Checking ${checkedWallets}/${totalWallets} wallets...`);
                }
            }));

            results.push(...batchResults.filter(result => result !== null));

            if (Date.now() - startTime > TIMEOUT_MS) {
                break;
            }
        }

        await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, `🟢 Checks finished! Loading results...`);

        const resultsMessage = results.map(res =>
            res.error
                ? `Wallet: ${res.address.substring(0, 4)}...\n❌ ${res.error}`
                : `Wallet: ${res.address.substring(0, 4)}...\n💰 Available to claim: ${res.solAbleToClaim} SOL${res.solToClaim > res.solAbleToClaim
                    ? `\n🔥 Burn tokens to claim: ${res.solToClaim} SOL`
                    : ''
                }`
        ).join('\n\n');

        await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, resultsMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔗 Connect wallet(s)', callback_data: 'connect' }],
                    [{ text: '← Back', callback_data: 'menu' }]
                ]
            }
        });
    } catch (error) {
        console.error('Error check button:', error.message);
        if (progressMessage) {
            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, '❌ Check failed, try again.');
        } else {
            await ctx.reply('❌ Check failed, try again.');
        }
    } finally {
        clearTokenData(ctx.from.id);
    }
}
