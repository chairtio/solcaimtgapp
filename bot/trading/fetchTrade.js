// commands/trading/fetchTokenDataCommand.js

import { isValidMintAddress, getMintInfo, escapeMarkdownV2, formatMarketCap, formatTVL, getTokenBalance, getUserSOLBalance, getTokenBalances, formatAmountToken } from './utilsTrading/tokenUtils.js';
import { getTradingInfo } from './utilsTrading/redisUtilsTrading.js';
import pTimeout from '../utils/pTimeout.js';
import { getRaydiumPairDetails } from './utilsTrading/raydiumApi.js';
import { fetchPoolInfo } from './utilsTrading/fetchPools.js';
import { fetchDexscreenerData } from './utilsTrading/dexscreener.js';
import { fetchData } from '../utils/fetchData.js';
import { urlTelegramWallets } from '../private/private.js';
import { buyButtons, sellButtons } from './utilsTrading/button.js';
import { getMintDataHelius } from './utilsTrading/fetchHelius.js';
import { fetchSolPrice } from './utilsTrading/fetchJupiter.js';
import { findBondingCurveAccount } from './utilsTrading/pumpfun.js';
import { getMetaplex } from './utilsTrading/getMetaplex.js';

export async function fetchTokenDataCommand(ctx, mintAddressStr = null) {
  try {
    const userId = ctx.from.id;
    if (!mintAddressStr) {
      if (ctx.message && ctx.message.text) {
        const input = ctx.message.text.split(' ');
        if (input.length < 2) {
          await ctx.reply(`Please use this format:\n \`/token token_address\``, {
            parse_mode: 'MarkdownV2',
          });
          return;
        }
        mintAddressStr = input[1];
      } else {
        await ctx.reply('No mint address provided.');
        return;
      }
    }

    if (!isValidMintAddress(mintAddressStr)) {
      await ctx.reply('Invalid token mint address.');
      return;
    }

    // const [tradingInfo, wallets, solPrice, mintData1, mintDataHelius, mintDataMetaplex, mintRayInfo, dexscreenerData] = await Promise.all([
    const [tradingInfo, wallets, solPrice, mintData1, mintDataHelius, mintRayInfo, dexscreenerData] = await Promise.all([
      pTimeout(getTradingInfo(userId), 10000),
      pTimeout(fetchData(`${urlTelegramWallets}?telegram_id=${userId}`), 10000),
      pTimeout(fetchSolPrice(), 10000),
      pTimeout(getMintInfo(mintAddressStr), 10000).catch(error => {
        console.error('Error fetching data from getMintInfo:', error.message);
        return {};
      }),
      pTimeout(getMintDataHelius(mintAddressStr), 10000).catch(error => {
        console.error('Error fetching data from getMintDataHelius:', error.message);
        return {};
      }),
      // pTimeout(getMetaplex(mintAddressStr), 10000).catch(error => {
      //   console.error('Error fetching data from mintDataMetaplex:', error.message);
      //   return {};
      // }),
      pTimeout(getRaydiumPairDetails(mintAddressStr), 10000).catch(error => {
        console.error('Error fetching data from Raydium fetch Trade:', error.message);
        return {};
      }),
      pTimeout(fetchDexscreenerData(mintAddressStr), 10000).catch(error => {
        console.error('Error fetching data from Dexscreener fetch Trade:', error.message);
        return { priceChange: { m5: 0.00, h1: 0.00, h24: 0.00 } };
      })
    ]);
    const { mintInfo: mintData2, name: nameToken1, symbol: symbolToken1, isPumpfun: isPumpfun1 } = mintDataHelius;
    // const { mintInfo: mintData3, name: nameToken2, symbol: symbolToken2, isPumpfun: isPumpfun2 } = mintDataMetaplex;

    const raydiumData = mintRayInfo || {};
    const dexData = dexscreenerData || {};
    const mintInfo = mintData1 || mintData2 || mintData3 || {};
    const id = dexData.id || raydiumData.id;
    const isPumpfun = isPumpfun1 || isPumpfun2

    // Add null checks
    const mintAuthorityStatus = mintInfo && (mintInfo.mintAuthority === null || mintInfo.mintAuthority === '' || mintInfo.mintAuthority === false) ? '✅' : '❌';
    const freezeAuthorityStatus = mintInfo && (mintInfo.freezeAuthority === null || mintInfo.freezeAuthority === '' || mintInfo.freezeAuthority === false) ? '✅' : '❌';
    
    const totalSupply = mintInfo ? Number(mintInfo.supply) : 0;
    const decimals = mintInfo ? mintInfo.decimals : 0;

    let name, symbol, tokenPrice, solVsToken, priceChange, poolSol, tokenPriceSol, tvl, liq;
    let progress;

    name = raydiumData?.name || dexData?.name || nameToken1 || nameToken2 || 'Unknown';
    symbol = raydiumData?.symbol || dexData?.symbol || symbolToken1 || symbolToken2 || 'Unknown';

    if (!id) {
      if (dexData && dexscreenerData) {
        // Destructure only if dexscreenerData is not null or undefined
        ({ name, symbol, tokenPrice, solVsToken, priceChange, tvl } = dexscreenerData);
        tokenPrice = typeof tokenPrice === 'number' ? tokenPrice : parseFloat(tokenPrice) || 0;
        solVsToken = typeof solVsToken === 'number' ? solVsToken : parseFloat(solVsToken) || 0;
      } else if (isPumpfun) {
        const bondingCurveData = await pTimeout(findBondingCurveAccount(mintAddressStr), 10000);
        tokenPriceSol = bondingCurveData.price;
        tokenPrice = tokenPriceSol * solPrice;
        tvl = (tokenPriceSol * bondingCurveData.tokenBalance) * solPrice + bondingCurveData.solBalance * solPrice;
        progress = bondingCurveData.bondingProgress;
        solVsToken = 1 / tokenPriceSol;
      } else {
        await ctx.reply('No liquidity found yet. Please try again later.');
        return;
      }
    } else {
      // When ID is present, proceed with fetching pool info and calculating values
      priceChange = dexData.priceChange || { m5: 0.00, h1: 0.00, h24: 0.00 };
      const poolId = id;
    
      const poolInfo = await pTimeout(fetchPoolInfo(poolId, mintAddressStr), 10000);
      if (!poolInfo) {
        await ctx.reply('No liquidity found yet. Please try again later');
        return;
      }
      ({ baseAmountSOL: poolSol, adjustedPoolPrice: solVsToken, tokenPriceSol, liq } = poolInfo);

      if (tokenPriceSol === undefined) {
        tokenPrice = solPrice / solVsToken;
        tvl = poolSol * solPrice * 2;
      } else {
        tokenPrice = parseFloat(tokenPriceSol) * solPrice;
        tvl = liq * solPrice;
      }
      // Compare TVL from Raydium with Dexscreener data
      if (tvl < 2000) {
        if (dexscreenerData.tvl) {
          // Use Dexscreener data if available
          ({ name, symbol, tokenPrice, solVsToken, priceChange, tvl } = dexscreenerData);
          tokenPrice = typeof tokenPrice === 'number' ? tokenPrice : parseFloat(tokenPrice) || 0;
          solVsToken = typeof solVsToken === 'number' ? solVsToken : parseFloat(solVsToken) || 0;
        }
      }
    }
    
    const tokenSymbol = symbol.toUpperCase();
    const tokenName = name;

    const formattedTokenSymbol = tokenSymbol.startsWith('$') ? tokenSymbol : `$${tokenSymbol}`;

    const marketCapUSD = (totalSupply * tokenPrice) / (10 ** decimals);
    const formattedMarketCap = formatMarketCap(marketCapUSD);
    const formattedTVL = formatTVL(tvl);

    const m5Change = typeof priceChange?.m5 === 'number' ? priceChange?.m5.toFixed(2) : '0.00';
    const h1Change = typeof priceChange?.h1 === 'number' ? priceChange?.h1.toFixed(2) : '0.00';
    const h24Change = typeof priceChange?.h24 === 'number' ? priceChange?.h24.toFixed(2) : '0.00';

    let message = ``
    message += `${escapeMarkdownV2(formattedTokenSymbol)} \\| ${escapeMarkdownV2(tokenName)}`;
    message += `\nCa: \`${mintAddressStr}\``;
    
    message += `\n\nPrice: *$${escapeMarkdownV2(tokenPrice.toFixed(8))}* — Liq: *${escapeMarkdownV2(formattedTVL)}* — MC: *${escapeMarkdownV2(formattedMarketCap)}*`;
    
    if (!isPumpfun || id) {
      message += `\n5m: *${escapeMarkdownV2(m5Change)}%* — 1h: *${escapeMarkdownV2(h1Change)}%* — 24h: *${escapeMarkdownV2(h24Change)}%*`;
    } else {
      const tokenSol = tokenPriceSol.toFixed(10);
    
      const filledBlocks = Math.floor(progress / 10);
      const emptyBlocks = 10 - filledBlocks;
    
      const progressBar = '🟩'.repeat(filledBlocks) + '⬜'.repeat(emptyBlocks);
    
      message += `\nPrice in Sol: *${escapeMarkdownV2(tokenSol)} SOL*\n${progressBar} *${progress.toFixed(0)}%*`;
    }
    message += `\n\n1 SOL ⇄ \`${escapeMarkdownV2(solVsToken.toFixed(0))}\` ${escapeMarkdownV2(tokenSymbol)}`;

    message += `\n\nRenounced: ${mintAuthorityStatus} — Freeze: ${freezeAuthorityStatus}\n\n`;

    const fee = tradingInfo.fee || 0.00001;
    const slippage = tradingInfo.slippage || 3;
    
    const isSelected = value => (fee === value ? '✅ ' : '');

    // Get all wallet settings from Redis
    const allWallets = tradingInfo.wallets || {};
    let keyboard = [];

    if (wallets && wallets.length > 0) {
      const limitedWallets = wallets.slice(0, 5); // Limit to the first 5 wallets
      const selectedWallets = limitedWallets.filter(wallet => allWallets[wallet.id]);
      const userPublicKeys = selectedWallets.map(wallet => wallet.public_key);
      const tokenBalances = await pTimeout(getTokenBalances(userPublicKeys, mintAddressStr, decimals), 10000);
      const totalTokenBalance = Object.values(tokenBalances).reduce((acc, balance) => acc + balance, 0);
    
      // Set keyboard based on totalTokenBalance
      keyboard = totalTokenBalance > 0
        ? [
            [{ text: 'Buy Mode ❌', callback_data: `buyMode:${mintAddressStr}` }, { text: 'Sell Mode ✅', callback_data: `sellMode:${mintAddressStr}` }],
            [{ text: `${isSelected(0.0005)} Fast 🐴`, callback_data: `feeSell0_0005:${mintAddressStr}` }, { text: `${isSelected(0.001)} Turbo 🚀`, callback_data: `feeSell0_001:${mintAddressStr}` }, { text: `${isSelected(0.005)} Ultra ⚡`, callback_data: `feeSell0_005:${mintAddressStr}` }],
            [{ text: `${![0.0005, 0.001, 0.005].includes(fee) ? '✅ ' : ''} ⛽️ Gas: ${fee} SOL (Custom)`, callback_data: `feeSellCustom:${mintAddressStr}` }, { text: `✏️ Slippage: ${slippage}%`, callback_data: `slippageSell:${mintAddressStr}` }],
          ]
        : [
            [{ text: 'Buy Mode ✅', callback_data: `buyMode:${mintAddressStr}` }, { text: 'Sell Mode ❌', callback_data: `sellMode:${mintAddressStr}` }],
            [{ text: `${isSelected(0.0005)} Fast 🐴`, callback_data: `feeBuy0_0005:${mintAddressStr}` }, { text: `${isSelected(0.001)} Turbo 🚀`, callback_data: `feeBuy0_001:${mintAddressStr}` }, { text: `${isSelected(0.005)} Ultra ⚡`, callback_data: `feeBuy0_005:${mintAddressStr}` }],
            [{ text: `${![0.0005, 0.001, 0.005].includes(fee) ? '✅ ' : ''} ⛽️ Gas: ${fee} SOL (Custom)`, callback_data: `feeBuyCustom:${mintAddressStr}` }, { text: `✏️ Slippage: ${slippage}%`, callback_data: `slippageBuy:${mintAddressStr}` }],
          ];
    
      const totalTokenValueUSD = totalTokenBalance * tokenPrice;
      const totalTokenValueSOL = totalTokenBalance * tokenPrice / solPrice;
      message += `Balance: \`${escapeMarkdownV2(formatAmountToken(totalTokenBalance.toFixed(2)))}\` *${escapeMarkdownV2(tokenSymbol)}* \\/ \`${escapeMarkdownV2(formatTVL((totalTokenValueUSD).toFixed(3)))}\` \\/ \`${escapeMarkdownV2((totalTokenValueSOL).toFixed(4))}\` *SOL*`;
    
      let selectedWalletsCount = 0;
      
      for (let i = 0; i < limitedWallets.length; i += 2) {
        const row = [];
        const wallet1 = limitedWallets[i];
        const truncatedPublicKey1 = `${wallet1.public_key.substring(0, 4)}...`;
        const isSelected1 = allWallets[wallet1.id] ? ' ✅' : '';
        if (isSelected1) selectedWalletsCount++;
    
        const walletButton1 = { 
          text: `Wallet ${i + 1}: ${truncatedPublicKey1}${isSelected1}`, 
          callback_data: `${totalTokenBalance > 0 ? 'walletS' : 'walletB'}:${wallet1.id}:${mintAddressStr}` 
        };
        row.push(walletButton1);
    
        if (limitedWallets[i + 1]) {
          const wallet2 = limitedWallets[i + 1];
          const truncatedPublicKey2 = `${wallet2.public_key.substring(0, 4)}...`;
          const isSelected2 = allWallets[wallet2.id] ? ' ✅' : '';
          if (isSelected2) selectedWalletsCount++;
    
          const walletButton2 = { 
            text: `Wallet ${i + 2}: ${truncatedPublicKey2}${isSelected2}`, 
            callback_data: `${totalTokenBalance > 0 ? 'walletS' : 'walletB'}:${wallet2.id}:${mintAddressStr}` 
          };
          row.push(walletButton2);
        }
    
        keyboard.push(row);
      }
    
      // Determine the text and callback data for the select/unselect button
      const selectButtonText = selectedWalletsCount === limitedWallets.length ? '💳 Unselect All' : '💳 Select All';
      const selectButtonCallback = selectedWalletsCount === limitedWallets.length
          ? (totalTokenBalance > 0 ? `unselectWalletsS:${mintAddressStr}` : `unselectWalletsB:${mintAddressStr}`)
          : (totalTokenBalance > 0 ? `selectWalletsS:${mintAddressStr}` : `selectWalletsB:${mintAddressStr}`);
      
      const selectButton = { 
        text: selectButtonText, 
        callback_data: selectButtonCallback 
      };
    
      if (limitedWallets.length % 2 !== 0) {
        keyboard[keyboard.length - 1].push(selectButton);
      } else {
        keyboard.push([selectButton]);
      }
      if (totalTokenBalance > 0) {
        keyboard.push(...sellButtons(mintAddressStr));
      } else {
        keyboard.push(...buyButtons(mintAddressStr));
      }
      // Add Wallet Settings button only if no wallets are connected
    } else if (wallets.length === 0) {
      keyboard = [
        [{ text: 'Buy Mode ✅', callback_data: `buyMode:${mintAddressStr}` }, { text: 'Sell Mode ❌', callback_data: `sellMode:${mintAddressStr}` }],
        [{ text: `${isSelected(0.0005)} Fast 🐴`, callback_data: `feeBuy0_0005:${mintAddressStr}` }, { text: `${isSelected(0.001)} Turbo 🚀`, callback_data: `feeBuy0_001:${mintAddressStr}` }, { text: `${isSelected(0.005)} Ultra ⚡`, callback_data: `feeBuy0_005:${mintAddressStr}` }],
        [{ text: `${![0.0005, 0.001, 0.005].includes(fee) ? '✅ ' : ''} ⛽️ Gas: ${fee} SOL (Custom)`, callback_data: `feeBuyCustom:${mintAddressStr}` }, { text: `✏️ Slippage: ${slippage}%`, callback_data: `slippageBuy:${mintAddressStr}` }],
      ];
      keyboard.push([{ text: '⚙️ Wallet Settings', callback_data: 'mywalletsReply' }]);
      keyboard.push(...buyButtons(mintAddressStr));
    }

    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
    // console.log(`API Fetch Time: ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Error fetch Trade:', error.message);
    console.error('Error fetch Trade:', error);

    await ctx.reply('No liquidity found yet. Please try again later.');
  }
}
