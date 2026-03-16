import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferCheckedInstruction } from "@solana/spl-token";
import { ComputeBudgetProgram, LAMPORTS_PER_SOL, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { connection } from '../private/private.js';
import { decimals, feePayerAirdrop, mintPubkey, sender, transactionPriorityFeeAirdrop, urlSolclaimAirdrop } from "./solclaimInfo.js";
import { sendMessageToAirdropsTopic } from "./sendMessageAirdropToTopic.js";
import { fetchData } from '../utils/fetchData.js';
import { updateProcessedRequestWithRetry } from './requestTracker.js';
import { abbreviateUserId } from "../utils/escapeMarkdownV2.js";
import { generateClaimedAirdrop } from "./generateClaimedAirdrop.js";

// Function to transfer tokens
export async function sendTokenAirdrop ({ request_id, airdrop_id, telegram_user_id, withdrawal_wallet, amount, username, bot }) {
    try {
        const fromPublicKey = new PublicKey(sender);
        const toPublicKey = new PublicKey(withdrawal_wallet);

        const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPublicKey);
        const toAta = await getAssociatedTokenAddress(mintPubkey, toPublicKey);

        // Check if the token account already exists
        const ataAccountInfo = await connection.getAccountInfo(toAta);

        // Create a new transaction
        const transaction = new Transaction();
        transaction.feePayer = feePayerAirdrop.publicKey;

        // Add compute unit and priority fee instructions
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 });
        const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: transactionPriorityFeeAirdrop * 10 * LAMPORTS_PER_SOL,
        });

        transaction.add(modifyComputeUnits);
        transaction.add(addPriorityFee);

        // If the associated token account does not exist, create it
        if (ataAccountInfo === null) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              feePayerAirdrop.publicKey, // payer
              toAta, // associated token account
              toPublicKey, // owner of the account
              mintPubkey // mint
            )
          );
        }

        // Create transfer instruction
        const transferInstruction = createTransferCheckedInstruction(
          fromAta,
          mintPubkey, // mint
          toAta, // to token account
          feePayerAirdrop.publicKey, // owner of the from account
          amount * Math.pow(10, decimals), // amount to transfer, adjusted for decimals
          decimals // decimals (use correct decimals for your token)
        );

        transaction.add(transferInstruction); // Add transfer instruction to the transaction
        try {
            const options = { commitment: 'confirmed' };
        
            // Send and confirm transaction
            const signature = await sendAndConfirmTransaction(connection, transaction, [feePayerAirdrop], options);
            console.log('\x1b[32m%s\x1b[0m', `Sent Airdrop Transaction confirmed: https://solscan.io/tx/${signature}`);

            // Update processed requests only after successful transaction confirmation
            await updateProcessedRequestWithRetry(telegram_user_id, signature, amount, false, airdrop_id, request_id); // Update JSON with transaction confirmed

            try {
                const url = `${urlSolclaimAirdrop}/${telegram_user_id}/processed`; // Construct the endpoint
                const payload = {
                  airdrop_id,
                  airdrop_request_id: request_id,
                  txid: signature
                };
            
                // Use fetchData utility to make the PUT request
                await fetchData(url, 'PUT', payload);
            
                // Proceed with further actions after a successful API call
                await updateProcessedRequestWithRetry(telegram_user_id, signature, amount, true, airdrop_id, request_id); // Update JSON with success
                let user_name;
                if (username && username.trim() !== '') {
                  user_name = `@${username}`;
                } else {
                    user_name = abbreviateUserId(telegram_user_id);
                }
                const groupMessage = `🟢 ${amount} $SCLAIM sent to [${user_name}](tg://user?id=${telegram_user_id}) ([tx link 🔗](https://solscan.io/tx/${signature}))`;
                const privateMessage = `🟢 Airdrop sent: ${amount} $SCLAIM\n💳 [Tx link](https://solscan.io/tx/${signature})`;
                const claimedImage = await generateClaimedAirdrop(amount, 'solclaim.jpg');

                await Promise.all([
                  sendMessageToAirdropsTopic(bot, groupMessage),
                  // bot.telegram.sendMessage(telegram_user_id, privateMessage, { parse_mode: 'Markdown' }),
                  bot.telegram.sendPhoto(
                      telegram_user_id,
                      { source: claimedImage },
                      {
                          caption: privateMessage,
                          parse_mode: 'Markdown',
                      }
                    )
                ]);
                // await bot.telegram.sendMessage('7046463711', privateMessage, { parse_mode: 'Markdown' })
                console.log(`Successfully updated API for User ID: ${telegram_user_id}`);

            } catch (apiError) {
                console.error(`Failed to update API for request ID ${request_id}.`);
                console.warn('API update failed, request will stay in pending state for future retries.');
            }

        } catch (txError) {
            console.error('Transaction confirmation or follow-up actions failed:', txError.message);
        }

    } catch (error) {
        console.error(`Error transferring tokens:`, error.message);
    }
}
