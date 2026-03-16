import ccxt from 'ccxt';
import { exchangesList } from '../private/private.js';
import { extractBaseCurrency, formatMarketCap, formatSymbol, getCryptoDetails, readExchangeMarkets } from './utilsPriceCoin.js';
import { rateLimiter } from './rateLimitUtils.js';
import pTimeout from '../utils/pTimeout.js';

// Function to get the price of a cryptocurrency from available exchanges
async function getPrice(symbol) {
  try {  
    const markets = await readExchangeMarkets();

    for (const exchangeName of exchangesList) {
      try {
        const allowed = await pTimeout(rateLimiter(exchangeName), 10000);
        if (!allowed) {
          console.warn(`Rate limit exceeded for ${exchangeName}.`);
          continue; // Skip this exchange if rate limit exceeded
        }

        const availableMarkets = markets[exchangeName] || [];
        const symbolExists = availableMarkets.some(market => market.symbol === symbol);

        if (!symbolExists) {
          continue; // Move to the next exchange if the symbol is not available
        }

        const exchange = new ccxt[exchangeName]();
        const { last, high, low, change, percentage } = await exchange.fetchTicker(symbol);
        const quoteCurrency = symbol.split('/')[1];
        const currencyLabel = ['USD', 'USDT'].includes(quoteCurrency) ? 'USD' : quoteCurrency;

        return { exchangeName, last, high, low, change, percentage, currencyLabel };
      } catch (error) {
        console.error(`Error in getPrice priceCoinCommand for ${exchangeName}: ${error.message}`);
      }
    }
    return null;
  } catch (error) {
    console.error(`Error in getPrice priceCoinCommand: ${error.message}`);
    return null; // Return null if there’s an error outside of the loop
  }
}

// Handle price command with error handling
export async function priceCoinCommand(ctx) {
  try {
    const args = ctx.message.text.split(' ').slice(1);
    const symbol = formatSymbol(args);
    const priceData = await pTimeout(getPrice(symbol), 12000);
    const baseCurrency = extractBaseCurrency(symbol);
    const cryptoDetails = await getCryptoDetails(baseCurrency);
    if (priceData) {
      let marketcap = 0;
      const { exchangeName, last, high, low, change, percentage, currencyLabel } = priceData;
      const rank = cryptoDetails ? cryptoDetails.rank : 'N/A';
      const cryptoName = cryptoDetails ? cryptoDetails.name : baseCurrency;
      const cryptoSupply = cryptoDetails ? cryptoDetails.supply : null;
      const percentageNew = percentage || 0;
      const highNew = high || 0;
      const lowNew = low || 0;

      if (cryptoSupply) {
        marketcap = cryptoSupply * last;
      }

      const formattedMarketCap = formatMarketCap(marketcap);

      const message = `*${cryptoName}* (*${baseCurrency}*)\n` +
        `🔹 *Rank:* ${rank}\n` +
        `🔹 *Price:* \`${last}\` ${currencyLabel}\n` +
        `🔹 *MarketCap:* *${formattedMarketCap}* ${currencyLabel}\n` +
        `🔹 *24hr Change:* ${percentageNew.toFixed(2)}%\n` +
        `🔹 *24hr High:* \`${highNew}\` ${currencyLabel}\n` +
        `🔹 *24hr Low:* \`${lowNew}\` ${currencyLabel}`;

      ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_to_message_id: ctx.message.message_id
      });
    } else {
      ctx.reply('Could not fetch price at the moment. Please try again later.', {
        reply_to_message_id: ctx.message.message_id
      });
    }
  } catch (error) {
    console.error('Error handling priceCoinCommand:', error.message);
    ctx.reply('Failed to retrieve price. Please try again later.', {
      reply_to_message_id: ctx.message.message_id
    });
  }
}
