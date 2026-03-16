// buttons/generateWalletButton.js
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { urlTelegramWallets } from '../private/private.js';
import { fetchData } from '../utils/fetchData.js';
import { deleteMessages } from '../utils/deleteMessages.js';
import { mywalletsButton } from './mywalletsButton.js';

export const generateWalletButton = async (ctx) => {
    const userId = ctx.from.id;

    // Generate a new wallet
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toString();
    const privateKey = bs58.encode(keypair.secretKey);

    let progressMessage;
    try {
        // Start sending progress message
        progressMessage = await ctx.reply('⏳ Generating wallet...');

        // Fetch existing wallets for the user
        const existingWallets = await fetchData(`${urlTelegramWallets}?telegram_id=${userId}`);

        const existingPublicKeys = existingWallets.map(wallet => wallet.public_key);
        const currentWalletCount = existingWallets.length;

        if (currentWalletCount >= 20) {
            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, `You can only have up to 20 wallets. You currently have ${currentWalletCount} wallets.`);
            return;
        }

        // Create wallet payload
        const walletPayload = {
            public_key: publicKey,
            private_key: privateKey,
        };

        // Check if the wallet already exists
        if (existingPublicKeys.includes(publicKey)) {
            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, '🚫 This wallet already exists.');
            return;
        }

        // Save the new wallet to the API
        await fetchData(urlTelegramWallets, 'POST', { wallets: [walletPayload], telegram_user_id: userId });

        let replyMessage = `✅ 1 wallet successfully generated.`;
        await mywalletsButton(ctx);

        await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, replyMessage);

    } catch (error) {
        console.error('Error generate wallet button:', error.message);

        // Reply with the error message
        const replyPromise = ctx.reply('❌ An error occurred while generating the wallet. Please try again later.');

        // Attempt to delete the progress message, if it exists
        const deleteProgressPromise = progressMessage
            ? deleteMessages(ctx, [progressMessage.message_id])
            : Promise.resolve(); // If progressMessage is not defined, resolve immediately

        // Wait for both promises to complete
        await Promise.all([replyPromise, deleteProgressPromise]);
    }
};
