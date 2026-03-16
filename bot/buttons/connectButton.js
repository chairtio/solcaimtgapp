// buttons/connectButton.js
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { urlTelegramWallets } from '../private/private.js';
import { mywalletsRefreshConnectButton } from '../miniButtons/mywalletsRefreshConnectButton.js';
import { fetchData } from '../utils/fetchData.js';
import { deleteMessages } from '../utils/deleteMessages.js';
import pTimeout from '../utils/pTimeout.js';

export const connectButton = async (ctx, editMessageConnectId) => {
    const userId = ctx.from.id;
    const originalMessageId = ctx.message.reply_to_message.message_id;
    const privateKeyInput = ctx.message.text.trim();
    const privateKeys = privateKeyInput.split('\n').map(key => key.trim()).filter(key => key.length > 0);

    const convertToBs58 = (input) => {
        try {
            const jsonArray = JSON.parse(input);
            if (Array.isArray(jsonArray) && jsonArray.every(num => typeof num === 'number')) {
                const uint8Array = new Uint8Array(jsonArray);
                return bs58.encode(uint8Array);
            }
        } catch (e) {
            // Not a valid JSON array, return the input as is
        }
        return input;
    };

    const privateKeysConverted = privateKeys.map(key => convertToBs58(key));

    let progressMessage;
    try {
        // Start sending progress message and delete messages concurrently
        const progressPromise = pTimeout(ctx.reply('⏳ Connecting wallet...'), 10000)
            .then(msg => progressMessage = msg);

        const deleteMessagesPromise = deleteMessages(ctx, [ctx.message.message_id, originalMessageId]);

        // Wait for both promises to complete
        await Promise.all([progressPromise, deleteMessagesPromise]);

        // Fetch existing wallets for the user
        const existingWallets = await fetchData(`${urlTelegramWallets}?telegram_id=${userId}`);

        // Check if existingWallets is an array
        if (!Array.isArray(existingWallets)) {
            console.error('Existing wallets response is not an array:', existingWallets);
            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, 'Error. Please try again later.');
            return;
        }

        const existingPublicKeys = existingWallets.map(wallet => wallet.public_key);
        const currentWalletCount = existingWallets.length;

        if (currentWalletCount + privateKeysConverted.length > 20) {
            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, `You can only have up to 20 wallets. You currently have ${currentWalletCount} wallets.`);
            return;
        }

        const walletPayloads = privateKeysConverted
            .map(privateKey => {
                const userPrivateKey = bs58.decode(privateKey);
                const userKeypair = Keypair.fromSecretKey(userPrivateKey);
                const userPublicKey = userKeypair.publicKey.toString();

                if (!existingPublicKeys.includes(userPublicKey)) {
                    return {
                        public_key: userPublicKey,
                        private_key: privateKey,
                    };
                } else {
                    console.log(`Wallet with public key ${userPublicKey} already exists.`);
                    return null;
                }
            })
            .filter(wallet => wallet !== null);

        if (walletPayloads.length === 0) {
            await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, '🚫 Wallet already connected');
            return;
        }

        // Save all user wallets to Supabase in a single request
        let successfulConnections = walletPayloads.length;
        let failedConnections = 0;
        try {
            await fetchData(urlTelegramWallets, 'POST', { wallets: walletPayloads, telegram_user_id: userId });
        } catch (err) {
            failedConnections = walletPayloads.length;
            successfulConnections = 0;
            console.error('Failed to save the wallets:', err.message);
        }

        let replyMessage = '';
        if (successfulConnections > 0) {
            replyMessage += `✅ ${successfulConnections} wallets successfully connected.`;
            await mywalletsRefreshConnectButton(ctx, editMessageConnectId);
        }

        if (failedConnections > 0) {
            replyMessage += `\n❌ ${failedConnections} wallets failed to connect.`;
        }

        await ctx.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, undefined, replyMessage);
    } catch (error) {
        console.error('Error connect Button:', error.message);

        // Reply with the error message
        const replyPromise = pTimeout(ctx.reply('❌ Invalid private key\\, try again\\.\n\nPaste up to 20 private keys [*\\(read here about why private keys are needed\\)*](https://t.me/SolClaimPortal/162)\\, each on a single line to connect them\\. For your security you can make sure they are empty\\, and all SOL claimed will be sent to your withdrawal address set in your \\/settings:\n\n\\*_Don’t want to claim in telegram and provide your key\\? Claim your SOL on the web app with phantom: [app\\.solclaim\\.io](https://t.me/SolClaimPortal/276)_', {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                force_reply: true,
            },
            disable_web_page_preview: true
        }), 10000);

        // Attempt to delete the progress message, if it exists
        const deleteProgressPromise = progressMessage
            ? deleteMessages(ctx, [progressMessage.message_id])
            : Promise.resolve(); // If progressMessage is not defined, resolve immediately
    
        // Wait for both promises to complete
        await Promise.all([replyPromise, deleteProgressPromise]);
    }
};


