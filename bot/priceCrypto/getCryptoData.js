import axios from 'axios';
import { redis } from "../private/private.js"; // Make sure to import your Redis client
import { apiKeyCoinMarketCap } from '../private/private.js';
import pTimeout from '../utils/pTimeout.js';

// Function to fetch all cryptocurrency data from CoinMarketCap and store in Redis
export async function fetchAllCryptoData(ctx) {
  try {
    const limit = 5000; // Maximum number of cryptocurrencies to fetch
    let allCryptos = []; // Array to store all cryptocurrency data
    let start = 1; // Starting index

    while (start <= 5000) { // Loop to fetch all pages (CoinMarketCap allows fetching 5000 max)
      const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
        headers: {
          'X-CMC_PRO_API_KEY': apiKeyCoinMarketCap,
        },
        params: {
          start: start, // Starting index
          limit: limit, // Number of results to return
          convert: 'USD', // Convert prices to USD
        },
      });

      // Append the fetched data to the allCryptos array
      allCryptos = allCryptos.concat(response.data.data.map(coin => ({
        rank: coin.cmc_rank,
        symbol: coin.symbol,
        name: coin.name,
        supply: coin.circulating_supply,
      })));

      // Break if there are no more results
      if (response.data.data.length < limit) {
        break;
      }

      // Increment the start index for the next request
      start += limit;
    }

    // Store all cryptocurrency data as a JSON string in Redis
    await pTimeout(redis.set('cryptoDataCMC', JSON.stringify(allCryptos)), 20000);
    // console.log('All cryptocurrency data updated successfully!');

    // Send a confirmation message back to the user
    await ctx.reply('All cryptocurrency data updated successfully!');
  } catch (error) {
    console.error('Error fetching cryptocurrency data:', error.message);
    // Send an error message back to the user
    await ctx.reply(`Error fetching cryptocurrency data: ${error.message}`);
  }
}
