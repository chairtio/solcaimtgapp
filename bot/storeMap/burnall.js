// storeMap/burnall.js
import { PublicKey, Keypair, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createBurnCheckedInstruction, getAccount } from "@solana/spl-token";
import { connection, feePayerWallet, transactionPriorityFee } from '../private/private.js';
import { getTokenData } from './checkClaim.js';
import bs58 from 'bs58';
import { getPriorityFeeEstimateHelius } from "./utilsGetEstimatedFee.js";

// List of token mints to exclude from burning
const excludedTokens = [
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT mint address
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  // USDC mint address
    "So11111111111111111111111111111111111111112"
];

export async function burnallChecked(userWallet, userId, ctx) {
    try {
        const { public_key: userpublicKey, private_key: userPrivateKey } = userWallet;

        if (!userpublicKey || !userPrivateKey) {
            console.error('Missing public or private key for user wallet');
            return { success: false, message: 'Missing keys' };
        }

        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 });

        // Fetch token accounts data and filter out excluded tokens and those with decimals: 0
        const tokenAccounts = (await getTokenData(userId)).tokenAccounts
            .filter(account => account.amount > 0 && !excludedTokens.includes(account.mint) && account.decimals !== 0);
    
        // const tokenAccounts = (await getTokenData(userId)).tokenAccounts.filter(account => account.amount > 0 && !excludedTokens.includes(account.mint));

        const batchSize = 10;
        let totalBurned = false;

        try {
            const batches = [];
            for (let i = 0; i < tokenAccounts.length; i += batchSize) {
                batches.push(tokenAccounts.slice(i, i + batchSize));
            }

            for (const batch of batches) {
                const transaction = new Transaction();
                transaction.add(modifyComputeUnits);

                let batchHasBurnedTokens = false;

                for (const { pubkey, mint, amount, decimals } of batch) {
                    const tokenAccountPubkey = new PublicKey(pubkey);
                    const mintPubkey = new PublicKey(mint);
                    const adjustedAmount = BigInt(Math.round(amount * 10 ** decimals));

                    // Check if the account is frozen
                    const tokenAccountInfo = await getAccount(connection, tokenAccountPubkey);
                    if (tokenAccountInfo.isFrozen) {
                        console.log(`Skipping frozen account: ${tokenAccountPubkey.toString()}`);
                        continue;
                    }

                    // Add burn checked instruction
                    transaction.add(
                        createBurnCheckedInstruction(
                            tokenAccountPubkey,
                            mintPubkey,
                            new PublicKey(userpublicKey),
                            adjustedAmount,
                            decimals
                        )
                    );

                    batchHasBurnedTokens = true;
                }
                
                const userKeypair = Keypair.fromSecretKey(bs58.decode(userPrivateKey));
                transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                transaction.sign(feePayerWallet, userKeypair);

                const estimatedFee = await getPriorityFeeEstimateHelius(transaction);
                
                // Determine which fee to use
                const maxPriorityFee = transactionPriorityFee * LAMPORTS_PER_SOL;
                const finalFee = Math.min(estimatedFee, maxPriorityFee);

                // Add compute budget instruction for priority fee only once
                const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: finalFee * 10 });
                transaction.add(addPriorityFee);

                if (batchHasBurnedTokens) {
                    const options = { commitment: 'confirmed' };
                    
                    try {
                        const signature = await sendAndConfirmTransaction(connection, transaction, [feePayerWallet, userKeypair], options);
                        console.log('\x1b[32m%s\x1b[0m', `Burned token account batch of size ${batch.length} in one transaction`);
                        console.log(`Transaction confirmed: https://solscan.io/tx/${signature}`);
                        totalBurned = true;
                    } catch (sendError) {
                        console.error('\x1b[31m%s\x1b[0m', `Failed to burn token account. Error:`, sendError);
                        const logs = sendError.logs;
                        console.error('Transaction logs:', logs);
                        return { success: false, message: 'Failed to burn token account', logs };
                    }
                }
            }

            return { success: totalBurned };
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', `Failed to burn token account. Error:`, error.message);
            return { success: false, message: 'Unexpected error' };
        }
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Unexpected error:`, error.message);
        return { success: false, message: 'Unexpected error' };
    }
}
