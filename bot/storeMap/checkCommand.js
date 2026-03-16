// commands/checkCommand.js
import { PublicKey } from "@solana/web3.js";
import { checkClaim, clearTokenData } from './checkClaim.js';
import pTimeout from '../utils/pTimeout.js';
import { SOL_CLAIM_PER_TOKEN_ACCOUNT } from '../private/private.js';

const TIMEOUT_MS = 60000;

// Add a blacklist array
const blacklist = [
    "ZG98FUCjb8mJ824Gbs6RsgVmr1FhXb2oNiJHa2dwmPd",
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL",
    // "arsc4jbDnzaqcCLByyGo7fg7S2SmcFsWUzQuDtLZh2y",
    // Add more blacklisted addresses here
];

export async function checkCommand(ctx) {
    const input = ctx.message.text.split(' ');

    try {
        if (input.length !== 2 || !PublicKey.isOnCurve(input[1])) {
            await ctx.reply(`Address issue\\. Please use this format:\n \`/check public_wallet_address\``, {
                parse_mode: 'MarkdownV2', 
                reply_to_message_id: ctx.message.message_id
            });
            return;
        }

        const address = input[1];

        // Check if the address is blacklisted
        if (blacklist.includes(address)) {
            // await ctx.reply(`The address ${address} is blacklisted.`);
            return;
        }

        const userId = ctx.from.id;

        const { tokenAccountsCount, zeroAmountAccountsCount } = await pTimeout(checkClaim(address, userId), TIMEOUT_MS);

        const solToClaim = tokenAccountsCount * SOL_CLAIM_PER_TOKEN_ACCOUNT;
        const solAbleToClaim = zeroAmountAccountsCount * SOL_CLAIM_PER_TOKEN_ACCOUNT;

        // Construct the reply message based on whether there was an error or not
        let replyMessage;
        if (typeof solToClaim === 'undefined' || typeof solAbleToClaim === 'undefined') {
            replyMessage = `Wallet: ${address.substring(0, 4)}...\n❌ Error`;
        } else {
            replyMessage = `Wallet: ${address.substring(0, 4)}...\n💰 Available to claim: ${solAbleToClaim.toFixed(4)} SOL${solToClaim > solAbleToClaim
                ? `\n🔥 Burn tokens to claim: ${solToClaim.toFixed(4)} SOL`
                : ''}`;
            // replyMessage = `Wallet: ${address.substring(0, 4)}...\n💰 Available to claim: ${solToClaim.toFixed(4)} SOL`;
        }

        // Check if the message is from a private chat or a group chat
        const isPrivateChat = ctx.chat.type === 'private';

        const replyMarkup = isPrivateChat ? {
            inline_keyboard: [
                [
                    {
                        text: '💰 Claim Sol Now',
                        callback_data: 'mywallets'
                    }
                ]
            ]
        } : {
            inline_keyboard: [
                [
                    {
                        text: '💰 Claim Sol Now',
                        url: 'https://t.me/solclaimxbot'
                    }
                ]
            ]
        };

        await ctx.reply(replyMessage, {
            reply_to_message_id: ctx.message.message_id,
            reply_markup: replyMarkup
        });

    } catch (error) {
        console.error('Error check Command:', error.message);
        await ctx.reply('Address error. Please check and try again.');
    } finally {
        const userId = ctx.from.id;
        clearTokenData(userId);
    }
}
