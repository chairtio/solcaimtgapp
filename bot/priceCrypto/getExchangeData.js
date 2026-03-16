import ccxt from 'ccxt';
import { exchangesList } from '../private/private.js';
import { redis } from "../private/private.js";
import pTimeout from '../utils/pTimeout.js';

// Fetch and save exchange markets to Redis
export async function fetchAndSaveMarkets(ctx) {
  try {
    const marketsData = {};

    for (const exchangeName of exchangesList) {
      try {
        const exchange = new ccxt[exchangeName]();
        const markets = await exchange.loadMarkets();

        // Store only the symbols from each market
        marketsData[exchangeName] = Object.keys(markets).map((symbol) => ({ symbol }));
      } catch (error) {
        console.error(`Error fetching markets from ${exchangeName}: ${error.message}`);
      }
    }

    // Store markets data as a JSON string in Redis
    await pTimeout(redis.set('exchangeMarketsCCXT', JSON.stringify(marketsData)), 20000);
    // console.log('Exchange markets saved successfully in Redis!');

    await ctx.reply('All exchange data updated successfully!');
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    await ctx.reply(`Error fetching exchange data: ${error.message}`);
  }
}

// Call the function to fetch and save markets
// fetchAndSaveMarkets();
