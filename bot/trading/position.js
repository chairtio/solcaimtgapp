import { Keypair } from '@solana/web3.js';
import pTimeout from '../utils/pTimeout.js';
import { getTradingInfo, getTokenMintAddresses, deleteTradingPosition, getTradingPositions, getTradingPosition, setTradingPosition } from './utilsTrading/redisUtilsTrading.js';
import { fetchData } from '../utils/fetchData.js';
import { urlTelegramWallets } from '../private/private.js';
import bs58 from 'bs58';
import { escapeMarkdownV2, formatAmountToken, formatMarketCap, formatTVL, getUserSOLBalance } from './utilsTrading/tokenUtils.js';
import { deleteMessages } from '../utils/deleteMessages.js';
import { searchAssetsTokenInfo } from './utilsTrading/fetchHelius.js';

// Handle wallet selection for positions
export const positionsCommand = async (ctx) => {
    try {
        const userId = ctx.from.id;

        // Fetch wallet info from API
        const wallets = await fetchData(`${urlTelegramWallets}?telegram_id=${userId}`);

        // Get position wallet from Redis
        const tradingInfo = await getTradingInfo(userId);
        const positionWallet = tradingInfo.positionWallet || {}; // Default to an empty object

        const hideToken = tradingInfo.hideToken === 'true';
        const showHidden = tradingInfo.showHidden === 'true';
        // Check if wallets are available
        if (wallets && wallets.length > 0) {
            const limitedWallets = wallets.slice(0, 5); // Limit to the first 5 wallets
            const keyboard = []; // Initialize keyboard array

            // Create keyboard rows
            for (let i = 0; i < limitedWallets.length; i += 2) {
                const row = [];
                const wallet1 = limitedWallets[i];
                const truncatedPublicKey1 = `${wallet1.public_key.substring(0, 4)}...`;
                const isSelected1 = positionWallet[wallet1.id] ? ' ✅' : '';
                const walletButton1 = { 
                    text: `Wallet ${i + 1}: ${truncatedPublicKey1}${isSelected1}`, 
                    callback_data: `walletP:${wallet1.id}` 
                };
                row.push(walletButton1);

                if (limitedWallets[i + 1]) {
                    const wallet2 = limitedWallets[i + 1];
                    const truncatedPublicKey2 = `${wallet2.public_key.substring(0, 4)}...`;
                    const isSelected2 = positionWallet[wallet2.id] ? ' ✅' : '';
                    const walletButton2 = { 
                        text: `Wallet ${i + 2}: ${truncatedPublicKey2}${isSelected2}`, 
                        callback_data: `walletP:${wallet2.id}` 
                    };
                    row.push(walletButton2);
                }

                keyboard.push(row);
            }

            // Add hide token button with check mark or red cross
            const hideTokenButton = { text: `Hide token < $1 ${hideToken ? '🟢' : '🔴'}`, callback_data: 'hideToken' }; // hide token <1$
            const showHiddenButton = { text: `Show hidden ${showHidden ? '🟢' : '🔴'}`, callback_data: 'showHidden'}; // show/hide token
            const closeButton = { text: 'Close ❌', callback_data: 'closeMessage' };
            const refrestButton = { text: '↻ Refresh', callback_data: 'positions'};
            const backToMenu = { text: 'Menu', callback_data: 'menu' }
            keyboard.push([hideTokenButton, showHiddenButton]);
            keyboard.push([refrestButton, closeButton]);
            keyboard.push([backToMenu]);
            // Show the current wallet's tokens
            if (Object.keys(positionWallet).length > 0) {
                const walletId = Object.keys(positionWallet)[0];
                const privateKeyBase58 = positionWallet[walletId];
                const publicKey = Keypair.fromSecretKey(bs58.decode(privateKeyBase58)).publicKey;
                const walletPublickey = publicKey.toBase58();
                // Get token mint addresses from Redis
                const allMintAddresses = await getTokenMintAddresses(userId, showHidden);
                const tradingPositions = await getTradingPositions(userId, allMintAddresses);
                let filteredMintAddresses = allMintAddresses;
                if (showHidden === true) {
                    // Get mint addresses where hidden is true
                    filteredMintAddresses = allMintAddresses.filter(mintAddress => {
                        const tradingPosition = tradingPositions[mintAddress];
                        return tradingPosition && tradingPosition.hidden === true;
                    });
                }
                const [tokensData, solBalance] = await Promise.all([
                    pTimeout(searchAssetsTokenInfo(publicKey, filteredMintAddresses, hideToken), 10000),
                    pTimeout(getUserSOLBalance(walletPublickey), 10000),
                ]);

                // Destructure the response from getTokenDetailsJup
                const { tokens, solPrice } = tokensData;
                let message;
                message = '👤 *PROFILE*\n\n';
                if (tokens.length > 0) {
                    tokens.forEach(token => {
                        token.tokenValueUSD = token.totalValueUSD;
                    });
                    tokens.sort((a, b) => b.tokenValueUSD - a.tokenValueUSD);
                    const tokenInfo = tokens
                        .map((token, index) => {
                            const tokenSupply = token.supply;
                            const tokenSymbol = token.symbol;
                            const tokenPrice = parseFloat(token.priceToken) || 0;
                            const amountToken = token.balanceToken;
                            const tokenMint = token.tokenAddress;
                            const priceTokenVsSol = tokenPrice / solPrice;
                            const tokenValueUSD = token.totalValueUSD;
                            const tokenValueSol = amountToken * priceTokenVsSol;
                            const marketCapUSD = tokenPrice * tokenSupply;
                            // Fetch trading position for the token
                            const tradingPosition = tradingPositions[tokenMint] || {};
                            const { amount_Token: positionToken = 0, amount_Sol: positionSol = 0, value_Sol: valueSol = 0, hidden } = tradingPosition;
                            
                            // Determine if buying or selling
                            const isBuying = positionToken > 0 && positionSol < 0;
                            const isSelling = positionToken < 0 && positionSol > 0;

                            // Handle position price calculation
                            const positionPrice = positionToken !== 0 ? Math.abs(positionSol) / Math.abs(positionToken) : 0;

                            const initialsSolPrice = Math.abs(valueSol / positionSol);
                            const initials = Math.abs(positionSol);
                            const entryMC = Math.abs(positionPrice * tokenSupply * initialsSolPrice);

                            const entryPrice = Math.abs((positionPrice * initialsSolPrice));

                            // Calculate PnL percentage based on buying or selling
                            let pnlPercentage = 0;
                            if (positionPrice > 0) {
                                if (isBuying) {
                                    pnlPercentage = ((priceTokenVsSol - positionPrice) / positionPrice) * 100;
                                } else if (isSelling) {
                                    pnlPercentage = ((positionPrice - priceTokenVsSol) / priceTokenVsSol) * 100;
                                }
                            }

                            const pnlIndicator = pnlPercentage <= 0 ? '🔴' : '🟢';
                            const hideShowLink = hidden === true ? `[\\[Show\\]](https://t.me/${ctx.botInfo.username}?start=hide-${tokenMint})` : `[\\[Hide\\]](https://t.me/${ctx.botInfo.username}?start=hide-${tokenMint})`;
                            const tokenDetails = `${index + 1}\\. [${escapeMarkdownV2(tokenSymbol)}](https://t.me/${ctx.botInfo.username}?start=trade-${tokenMint}) *\\(${escapeMarkdownV2(formatTVL(tokenValueUSD))}\\)* ${hideShowLink} [\\[Delete\\]](https://t.me/${ctx.botInfo.username}?start=delete-${tokenMint})` +
                                `\n• Balance: *${escapeMarkdownV2(formatAmountToken(amountToken))} ${escapeMarkdownV2(tokenSymbol)} Ξ ${escapeMarkdownV2((tokenValueSol).toFixed(3))} SOL*` +
                                `\n• Price & MC: \`$${escapeMarkdownV2(tokenPrice.toFixed(8))}\` — *${escapeMarkdownV2(formatMarketCap(marketCapUSD))}*` +
                                `\n• Average entry: \`$${escapeMarkdownV2(entryPrice.toFixed(8))}\` — *${escapeMarkdownV2(formatMarketCap(entryMC))}*` +
                                `\n• Initials: *${escapeMarkdownV2((initials).toFixed(3))} SOL*` +
                                `\n${pnlIndicator} Current PNL: *${escapeMarkdownV2(pnlPercentage.toFixed(2))}%*`;
                         
                            // if ( showHidden === true && hidden === true) {
                            //     return tokenDetails;
                            // }
                            // if ( showHidden !== true) {
                            //     return tokenDetails;
                            // }
                            // return undefined;

                            return tokenDetails;

                        })
                        .filter(info => info !== undefined) // Remove any undefined entries
                        .slice(0, 20) // Limit to the first 20 tokens
                        .join('\n\n');
                    message += tokenInfo;
                } else {
                    message += `No tokens bought\\, paste any CA in the chat and start trading\\.`;
                }
                message += `\n\n`;
                message += `Balance: *${escapeMarkdownV2(solBalance.toFixed(3))} SOL / $${escapeMarkdownV2((solBalance * solPrice).toFixed(2))}*\n`;

                // Check if we need to edit or send a new message
                if (ctx.callbackQuery) {
                    // If we have a callback query, use editMessageText
                    await ctx.editMessageText(message, {
                        parse_mode: 'MarkdownV2',
                        reply_markup: {
                            inline_keyboard: keyboard
                        },
                        disable_web_page_preview: true
                    });
                } else {
                    // Otherwise, use reply
                    await ctx.reply(message, {
                        parse_mode: 'MarkdownV2',
                        reply_markup: {
                            inline_keyboard: keyboard
                        },
                        disable_web_page_preview: true
                    });
                }
            } else {
                if (ctx.callbackQuery) {
                    // If we have a callback query, use editMessageText
                    await ctx.editMessageText('Please select a wallet to view.', {
                        reply_markup: {
                            inline_keyboard: keyboard
                        }
                    });
                } else {
                    // Otherwise, use reply
                    await ctx.reply('Please select a wallet to view.', {
                        reply_markup: {
                            inline_keyboard: keyboard
                        }
                    });
                }
            }
        } else {
            await ctx.reply('No wallets found.');
        }
    } catch (error) {
        if (!error.message.includes('specified new message content and reply markup are exactly the same as a current content and reply markup of the message')) {
            console.error('Error in positionsCommand:', error.message);
        }
    }
};


export async function deleteToken(ctx, mintAddress) {
    try {
        const userId = ctx.from.id;
        await deleteTradingPosition(userId, mintAddress);
        await Promise.all([
            pTimeout(positionsCommand(ctx), 10000),
            deleteMessages(ctx, [ctx.message.message_id]),
        ])
    } catch (error) {
        console.error('Error delete token:', error.message);
        await ctx.reply('Failed to delete token. Please try again later.');
    }
}

export async function hideToken(ctx, mintAddress) {
    try {
        const userId = ctx.from.id;

        const currentPosition = await getTradingPosition(userId, mintAddress);

        if (!currentPosition) {
            await ctx.reply('No position found for this token.');
            return;
        }

        // Toggle the 'hidden' field (default is false, meaning it's visible)
        const updatedPosition = {
            ...currentPosition,
            hidden: !currentPosition.hidden // If undefined or false, it becomes true (hidden)
        };

        // Update the trading position with the new 'hidden' status
        await setTradingPosition(userId, mintAddress, updatedPosition);

        // Execute commands to refresh the display and delete the message
        await Promise.all([
            pTimeout(positionsCommand(ctx), 10000), // Update the token display
            deleteMessages(ctx, [ctx.message.message_id]) // Delete the message from the chat
        ]);

    } catch (error) {
        console.error('Error hiding token:', error.message);
        await ctx.reply('Failed to hide token. Please try again later.');
    }
}
