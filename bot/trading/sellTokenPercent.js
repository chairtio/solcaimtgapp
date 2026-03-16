import { Keypair, VersionedTransaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { getTradingInfo, updateTradingPosition } from './utilsTrading/redisUtilsTrading.js';
import { connection } from '../private/private.js';
import pTimeout from '../utils/pTimeout.js';
import { escapeMarkdownV2, getTokenBalance, getUserSOLBalance } from './utilsTrading/tokenUtils.js';
import { getTokenData } from './utilsTrading/getTokenData.js';
import bs58 from 'bs58';
import { getSymbolJup } from './utilsTrading/getSymbolJup.js';
import { fetchSolPrice } from './utilsTrading/fetchJupiter.js';

// Function to fetch token decimals
async function fetchTokenDecimals(tokenMintAddress) {
  try {
    const tokenMintPublicKey = new PublicKey(tokenMintAddress);
    const tokenInfo = await connection.getTokenSupply(tokenMintPublicKey);
    return tokenInfo.value.decimals;
  } catch (error) {
    console.error('Error fetching token decimals:', error.message);
    throw error;
  }
}

// Main function to execute the token swap
export async function sellTokenPercent(ctx, options = {}) {
  try {
    const userId = ctx.from.id;
    const amountTokenPercent = options.amount || (ctx.callbackQuery?.data.split(':')[0] || '');
    const mintAddress = options.mintAddressStr || (ctx.callbackQuery?.data.split(':')[1] || '');
    const tradingInfo = await getTradingInfo(userId);
    const fee = tradingInfo.fee || 0.00001;
    const slippage = tradingInfo.slippage || 3;
    const userWallets = tradingInfo.wallets || {};

    if (!userWallets || Object.keys(userWallets).length === 0) {
      await ctx.reply('⚠️ Wallets not found! Please set them up and try again.');
      return;
    }

    // Object to keep track of progress messages by walletId
    const progressMessages = {};

    // Iterate over each wallet and perform the sell operation
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

        const progressMessage = await ctx.reply(escapeMarkdownV2(`🟠 Selling for wallet \`${userpublicKey}\`...`), {
          parse_mode: 'MarkdownV2'
        });
        progressMessages[walletId] = progressMessage.message_id;
        
        const decimals = await pTimeout(fetchTokenDecimals(mintAddress), 10000);

        const [userSOLBalance, tokenBalance, tokenSymbol1, tokenSymbol2, solPrice] = await Promise.all([
          pTimeout(getUserSOLBalance(userpublicKey), 10000),
          pTimeout(getTokenBalance(userpublicKey, mintAddress, decimals), 10000),
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

        if (userSOLBalance < parseFloat(fee)) {
          await ctx.telegram.editMessageText(ctx.chat.id, progressMessages[walletId], undefined, `🔴 Insufficient balance for gas fee \\| Wallet: \`${escapeMarkdownV2(userpublicKey)}\``, {
            parse_mode: 'MarkdownV2'
          });
          return;
        }

        if (tokenBalance === 0) {
          await ctx.telegram.editMessageText(ctx.chat.id, progressMessages[walletId], undefined, `🔴 No token for sell \\| Wallet: \`${escapeMarkdownV2(userpublicKey)}\``, {
            parse_mode: 'MarkdownV2'
          });
          return;
        }

        const amountTokenSell = parseFloat((tokenBalance * amountTokenPercent / 100).toFixed(decimals));
        
        const MAX_SLIPPAGE = 10;
        const slippageUser = Math.min(slippage, MAX_SLIPPAGE);
        
        // Convert slippage to basis points for API calls
        const slippageBps = Math.round(slippageUser * 100); // Convert to basis points (e.g., 3% -> 300)

        const quoteResponse = await axios.get('https://quote-api.jup.ag/v6/quote', {
          params: {
            inputMint: mintAddress,
            outputMint: 'So11111111111111111111111111111111111111112',
            amount: Math.round(amountTokenSell * (10 ** decimals)),
            slippageBps: slippageBps,
          }
        }).then(response => response.data)
        
        const swapTransaction = await fetch('https://quote-api.jup.ag/v6/swap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            quoteResponse,
            userPublicKey: userpublicKey,
            dynamicComputeUnitLimit: true,
            // prioritizationFeeLamports: Math.round((fee - 0.000005) * LAMPORTS_PER_SOL),
            dynamicSlippage: { "maxBps": slippageBps },
            prioritizationFeeLamports: {
              priorityLevelWithMaxLamports: {
                  maxLamports: Math.round((fee - 0.000005) * LAMPORTS_PER_SOL),
                  priorityLevel: "veryHigh"
              }
            }
          })
        }).then(response => response.json())

        // if (swapTransaction.error) {
        //   throw new Error('Transaction failed');
        // }

        const swapTransactionBuf = Buffer.from(swapTransaction.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

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

        console.log(`Sold Transaction confirmed: https://solscan.io/tx/${txid}`);

        const amountReceived = quoteResponse.outAmount / LAMPORTS_PER_SOL;

        const messageResult = `💰 Sold \`${escapeMarkdownV2(amountTokenSell)}\` ${escapeMarkdownV2(tokenSymbol)} for \`${escapeMarkdownV2(amountReceived)}\` SOL at [Transaction](https://solscan.io/tx/${txid})\nWallet: \`${userpublicKey}\``;
        await ctx.telegram.editMessageText(ctx.chat.id, progressMessages[walletId], undefined, messageResult, {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true
        });

        const valueSol = amountReceived * solPrice;
        
        // Update trading position after successful transaction
        await updateTradingPosition(userId, mintAddress, -amountTokenSell, amountReceived, valueSol);

      } catch (error) {
        // console.error(`Error selling token for wallet ${walletId}:`, error.message);
        await ctx.telegram.editMessageText(ctx.chat.id, progressMessages[walletId], undefined, `🔴 Transaction failed`);
      }
    });

    // Await all transaction processing promises
    await pTimeout(Promise.all(transactions), 60000);

  } catch (error) {
    console.error('Error processing transactions:', error.message);
    await ctx.telegram.sendMessage(ctx.chat.id, '🔴 Transaction failed');
  }
}
