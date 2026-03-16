// storeMap/close.js
import { PublicKey, Keypair, Transaction, sendAndConfirmTransaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from "@solana/web3.js";
import { createCloseAccountInstruction } from "@solana/spl-token";
import { feePayerWallet, commissionAddress, baseCommissionRate, transactionPriorityFee, connection, SOL_CLAIM_PER_TOKEN_ACCOUNT, totalAmountClaim, urlClaim } from '../private/private.js';
import { getTokenData } from './checkClaim.js';
import { getUserWithdrawWallet } from '../utils/getUserWithdrawWallet.js';
import { postToApi } from '../utils/postToApi.js';
import bs58 from 'bs58';
import { redis } from "../private/private.js";
import pTimeout from '../utils/pTimeout.js';
import { getPriorityFeeEstimateHelius } from "./utilsGetEstimatedFee.js";

export async function closeTokenAccounts(userWallet, userId, ctx, walletId) {
    try {
        const { public_key: userpublicKey, private_key: userPrivateKey } = userWallet;

        if (!userpublicKey || !userPrivateKey) {
            console.error('Missing public or private key for user wallet');
            return { success: false, message: 'Missing keys' };
        }

        // Fetch user withdrawal wallet from database
        const userWithdrawWallet = await getUserWithdrawWallet(userId);
        if (!userWithdrawWallet) {
            console.error('User withdrawal wallet not found');
            return { success: false, message: 'User withdrawal wallet not found' };
        }

        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 });
        const tokenAccounts = (await getTokenData(userId)).tokenAccounts.filter(account => account.amount === 0);

        const batchSize = 20; // Can adjust this value based on network and program constraints

        try {
            const batches = [];
            for (let i = 0; i < tokenAccounts.length; i += batchSize) {
                batches.push(tokenAccounts.slice(i, i + batchSize));
            }

            for (const batch of batches) {
                const transaction = new Transaction();
                const amounttotalamountclaim = totalAmountClaim * batch.length;
                const amountsolforCommission = baseCommissionRate * batch.length;
                const amountsolforwithdrawal = SOL_CLAIM_PER_TOKEN_ACCOUNT * batch.length;
                transaction.add(modifyComputeUnits);

                for (const { pubkey } of batch) {
                    const tokenAccountPubkey = new PublicKey(pubkey);

                    // Add close account instruction
                    transaction.add(
                        createCloseAccountInstruction(
                            tokenAccountPubkey,
                            new PublicKey(userpublicKey),
                            new PublicKey(userpublicKey),
                        )
                    );
                }

                // Add withdrawal address transfer instruction
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: new PublicKey(userpublicKey),
                        toPubkey: userWithdrawWallet,
                        lamports: Math.round(amountsolforwithdrawal * LAMPORTS_PER_SOL),
                    })
                );

                // Add commission transfer instruction
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: new PublicKey(userpublicKey),
                        toPubkey: commissionAddress,
                        lamports: Math.round(amountsolforCommission * LAMPORTS_PER_SOL),
                    })
                );

                const userKeypair = Keypair.fromSecretKey(bs58.decode(userPrivateKey));
                transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                transaction.sign(feePayerWallet, userKeypair);

                const estimatedFee = await getPriorityFeeEstimateHelius(transaction);
                // console.log(`Estimated fee for transaction: ${estimatedFee} lamports`);

                // Determine which fee to use
                const maxPriorityFee = transactionPriorityFee * LAMPORTS_PER_SOL;
                const finalFee = Math.min(estimatedFee, maxPriorityFee);
                // console.log(`Using fee: ${finalFee} lamports`);

                // Add compute budget instruction for priority fee only once
                const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: finalFee *10 });
                transaction.add(addPriorityFee);

                const options = { commitment: 'confirmed' };

                try {
                    // Attempt to send and confirm transactions
                    const signature = await sendAndConfirmTransaction(connection, transaction, [feePayerWallet, userKeypair], options);
                    console.log('\x1b[32m%s\x1b[0m', `Closed token account batch of size ${batch.length} in one transaction`);
                    console.log(`Transaction confirmed: https://solscan.io/tx/${signature}`);

                    // // Delete redis data
                    // try {
                    //     await pTimeout(redis.del(`userCreationTime:${userId}`), 10000);
                    // } catch (error) {
                    //     console.error(`Failed to delete redis userCreationTime for user ${userId}:`, error.message);
                    // }

                    // Continue with POST method logging
                    const postData = {
                        telegram_user_id: userId,
                        wallet_id: walletId,
                        fee: amountsolforCommission,
                        tx_id: signature,
                        amount: amounttotalamountclaim,
                        payout_amount: amountsolforwithdrawal,
                    };

                    await postToApi(urlClaim, postData);

                } catch (sendError) {
                    console.error('\x1b[31m%s\x1b[0m', `Failed to close token account. Error:`, sendError);
                    const logs = sendError.logs;
                    console.error('Transaction logs:', logs);

                    // POST to your API endpoint in case of failure
                    const postData = {
                        telegram_user_id: userId,
                        wallet_id: walletId,
                        fee: amountsolforCommission,
                        tx_id: 'N/A', // Handle transaction ID in case of failure
                        amount: amounttotalamountclaim,
                        payout_amount: amountsolforwithdrawal,
                    };

                    try {
                        await postToApi(urlClaim, postData);

                    } catch (postError) {
                        console.error('Failed to log error to Xano:', postError);
                    }

                    return { success: false, message: 'Failed to close token account', logs };
                }
            }

            return { success: true }; // Return success after all processing is complete

        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', `Failed to close token account. Error:`, error.message);
            return { success: false, message: 'Unexpected error' };
        }
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Unexpected error:`, error.message);
        return { success: false, message: 'Unexpected error' };
    }
}

