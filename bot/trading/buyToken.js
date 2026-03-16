import { Keypair, VersionedTransaction, LAMPORTS_PER_SOL, PublicKey, TransactionInstruction, TransactionMessage } from '@solana/web3.js';
import axios from 'axios';
import { getTradingInfo, setTradingInfo, updateTradingPosition } from './utilsTrading/redisUtilsTrading.js';
import { connection, urlUserTradingBot } from '../private/private.js';
import pTimeout from '../utils/pTimeout.js';
import { deleteMessages } from '../utils/deleteMessages.js';
import { getTokenData } from './utilsTrading/getTokenData.js';
import { escapeMarkdownV2, fetchTokenDecimals, getAddressLookupTableAccounts, getUserSOLBalance } from './utilsTrading/tokenUtils.js';
import bs58 from 'bs58';
import { getSymbolJup } from './utilsTrading/getSymbolJup.js';
import { fetchSolPrice } from './utilsTrading/fetchJupiter.js';
import { fetchData } from '../utils/fetchData.js';

// Main function to execute the token swap
export async function buyToken(ctx, options = {}) {

  try {
    const userId = ctx.from.id;
    const tradingInfo = await getTradingInfo(userId);
    const fee = tradingInfo.fee || 0.00001;
    const slippage = tradingInfo.slippage || 3;
    const userWallets = tradingInfo.wallets || {};

    if (!userWallets || Object.keys(userWallets).length === 0) {
      const originalMessageId = ctx.message?.reply_to_message?.message_id;
      if (originalMessageId) {
        await Promise.all([
          pTimeout(ctx.reply('⚠️ Wallets not found! Please set them up and try again.'), 10000),
          deleteMessages(ctx, [ctx.message.message_id, originalMessageId])
        ]);
      } else {
        await ctx.reply('⚠️ Wallets not found! Please set them up and try again.');
      }
      return;
    }

    const amountSol = options.amount || (ctx.callbackQuery?.data.split(':')[0] || '');
    const mintAddress = options.mintAddressStr || (ctx.callbackQuery?.data.split(':')[1] || '');

    if (!mintAddress) {
      throw new Error('Missing mint address');
    }

    // Object to keep track of progress messages by walletId
    const progressMessages = {};

    // Deleting the original message if it exists
    const originalMessageId = ctx.message?.reply_to_message?.message_id;
    const deleteMessagePromise = originalMessageId ? deleteMessages(ctx, [ctx.message.message_id, originalMessageId]) : Promise.resolve();

    // Send progress message and handle transactions
    const transactions = Object.entries(userWallets).map(async ([walletId, privateKey]) => {
      try {
        // Decode the private key
        const privateKeyArray = bs58.decode(privateKey);
        if (privateKeyArray.length !== 64) {
          throw new Error('Invalid secret key size');
        }

        // Derive the Keypair and PublicKey from the private key
        const userWalletTrade = Keypair.fromSecretKey(privateKeyArray);
        const userpublicKey = userWalletTrade.publicKey.toString();
        
        // Send progress message for each wallet and store the message ID
        const progressMessage = await ctx.reply(escapeMarkdownV2(`🟠 Buying for wallet: \`${userpublicKey}\`...`), {
          parse_mode: 'MarkdownV2'
        });
        progressMessages[walletId] = progressMessage.message_id;

        const [userSOLBalance, tokenDecimals, tokenSymbol1, tokenSymbol2, solPrice] = await Promise.all([
          pTimeout(getUserSOLBalance(userpublicKey), 10000),
          pTimeout(fetchTokenDecimals(mintAddress), 10000),
          pTimeout(getTokenData(mintAddress), 10000).catch(error => {
            console.error('Error fetching token Metadata buyToken:', error.message);
            return null;
          }),
          pTimeout(getSymbolJup(mintAddress), 10000).catch(error => {
            console.error('Error fetching jup symbol buyToken:', error.message);
            return null;
          }),
          pTimeout(fetchSolPrice(), 10000).catch(error => {
            console.error('Error fetching SOL price buy Token:', error.message);
            return 0;
          })
        ]);

        const tokenSymbol = tokenSymbol1 || tokenSymbol2 || 'null';

        // const amountLamports = amountSol/100; // fee commission

        // const totalCost = parseFloat(amountSol) + parseFloat(fee) + parseFloat(amountLamports);

        const totalCost = parseFloat(amountSol) + parseFloat(fee);

        if (userSOLBalance < totalCost) {
          await ctx.telegram.editMessageText(ctx.chat.id, progressMessages[walletId], undefined, `🔴 Insufficient balance for buy \\| Wallet: \`${userpublicKey}\``, {
            parse_mode: 'MarkdownV2'
          });
          return; // Skip to the next wallet
        }

        const MAX_SLIPPAGE = 10;
        const slippageUser = Math.min(slippage, MAX_SLIPPAGE);
        
        // Convert slippage to basis points for API calls
        const slippageBps = Math.round(slippageUser * 100); // Convert to basis points (e.g., 3% -> 300)
        // console.log('slippageBps', slippageBps);

        const quoteResponse = await axios.get('https://quote-api.jup.ag/v6/quote', {
          params: {
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: mintAddress,
            amount: Math.round(amountSol * LAMPORTS_PER_SOL),
            slippageBps: slippageBps,
          }
        }).then(response => response.data);
        const swapInstructionsResponse = await axios.post('https://quote-api.jup.ag/v6/swap-instructions', {
          quoteResponse,
          userPublicKey: userpublicKey,
          dynamicComputeUnitLimit: true,
          dynamicSlippage: { "maxBps": slippageBps },
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
                maxLamports: Math.round((fee - 0.000005) * LAMPORTS_PER_SOL), // e.g., calculated to be 45000
                priorityLevel: "veryHigh"
            }
          }
          // prioritizationFeeLamports: Math.round((fee - 0.000005) * LAMPORTS_PER_SOL),
        }).then(response => response.data);

        // console.log('quoteResponse', quoteResponse);
        // console.log('Route Plan:', quoteResponse.routePlan);

        const {
          swapInstruction: swapInstructionPayload,
          computeBudgetInstructions,
          setupInstructions,
          cleanupInstruction,
          addressLookupTableAddresses,
        } = swapInstructionsResponse;

        const deserializeInstruction = (instruction) => {
          return new TransactionInstruction({
            programId: new PublicKey(instruction.programId),
            keys: instruction.accounts.map((key) => ({
              pubkey: new PublicKey(key.pubkey),
              isSigner: key.isSigner,
              isWritable: key.isWritable,
            })),
            data: Buffer.from(instruction.data, "base64"),
          });
        };   

        const addressLookupTableAccounts = await getAddressLookupTableAccounts(addressLookupTableAddresses);

        const blockhash = (await connection.getLatestBlockhash()).blockhash;
        const messageV0 = new TransactionMessage({
          payerKey: userWalletTrade.publicKey,
          recentBlockhash: blockhash,
          instructions: [
            ...setupInstructions.map(deserializeInstruction),
            deserializeInstruction(swapInstructionPayload),
            cleanupInstruction ? deserializeInstruction(cleanupInstruction) : undefined,
            ...computeBudgetInstructions.map(deserializeInstruction),
          ].filter(Boolean),
        }).compileToV0Message(addressLookupTableAccounts);

        const transaction = new VersionedTransaction(messageV0);
        
        transaction.sign([userWalletTrade]);

        const checkTransactionStatus = async (txid, retries = 8, delay = 5600) => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          for (let i = 0; i < retries; i++) {
            const { value } = await connection.getSignatureStatuses([txid]);
            const status = value[0];
        
            if (status && status.confirmations) {
              return status; // Transaction is confirmed
            }
        
            // console.log(`Retrying to check transaction status (${i + 1}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        
          return null;
        };

        const rawTransaction = transaction.serialize();
        const txid = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 2
        });
        
        const status = await checkTransactionStatus(txid);
        console.log('status', status)
        if (!status || status.err) {
          // Notify the user about the transaction failure with the txid link
          await ctx.telegram.editMessageText(ctx.chat.id, progressMessages[walletId], undefined, `🔴 [Transaction](https://solscan.io/tx/${txid}) failed`, {
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true
          });
          return; // Stop further processing
        }

        console.log(`Bought Transaction confirmed: https://solscan.io/tx/${txid}`);

        const amountReceived = quoteResponse.outAmount / (10 ** tokenDecimals);

        const messageResult = `🚀 Bought \`${escapeMarkdownV2(amountReceived)}\` ${escapeMarkdownV2(tokenSymbol)} for \`${escapeMarkdownV2(amountSol)}\` SOL at [Transaction](https://solscan.io/tx/${txid})\nWallet: \`${userpublicKey}\``;
        await ctx.telegram.editMessageText(ctx.chat.id, progressMessages[walletId], undefined, messageResult, {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true
        });
        
        const valueSol = amountSol * solPrice;

        // Update trading position after successful transaction
        await updateTradingPosition(userId, mintAddress, amountReceived, - amountSol, - valueSol);
        if (!tradingInfo.traded) {
          try {
            const urlTrading = `${urlUserTradingBot}/${userId}`;
            const response = await fetchData(urlTrading, 'PUT', { bought: true });
            // console.log('response', response)
            // Add 'traded' field only if it's not present
            await setTradingInfo(userId, { ...tradingInfo, traded: true });
          } catch (error) {
            console.error('Error updating trading info or fetching data buyToken:', error.message);
          }
        }
      } catch (error) {
        // console.error('Transaction error Buytoken:', error.message);
        await ctx.telegram.editMessageText(ctx.chat.id, progressMessages[walletId], undefined, `🔴 Transaction failed`);
      }
    });

    // Await all transaction processing and message deletion promises
    await pTimeout(Promise.all([
      deleteMessagePromise,
      ...transactions
    ]), 60000);

  } catch (error) {
    console.error('Error processing transactions:', error.message);
    await ctx.telegram.sendMessage(ctx.chat.id, `🔴 Transaction failed`);
  }
}
