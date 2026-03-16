import { redis } from "../private/private.js"; // Make sure to import your Redis client
import pTimeout from '../utils/pTimeout.js';


// Fetch exchange markets from Redis
export async function readExchangeMarkets() {
  try {
    const data = await pTimeout(redis.get('exchangeMarketsCCXT'), 5000); // Fetch data from Redis
    return data ? JSON.parse(data) : {}; // Parse and return data or an empty object if not found
  } catch (error) {
    console.error('Error reading exchange markets from Redis:', error.message);
    return {}; // Return an empty object in case of error
  }
}

// Get cryptocurrency details (name, rank, and supply) based on the symbol
export const getCryptoDetails = async (symbol) => {
  try {
    const cachedData = await pTimeout(redis.get('cryptoDataCMC'), 5000); // Get data from Redis
    if (cachedData) {
      const symbols = JSON.parse(cachedData); // Parse the JSON data
      const normalizedSymbol = symbol.toLowerCase();
      const found = symbols.find(
        (crypto) => crypto.symbol.toLowerCase() === normalizedSymbol
      );

      return found
        ? { name: found.name, rank: found.rank, supply: found.supply }
        : null; // Return null if not found
    } else {
      console.error('No cryptocurrency data found in Redis.');
      return null; // Return null if no data is cached
    }
  } catch (error) {
    console.error(`Error getting crypto details for ${symbol}: ${error.message}`);
    return null; // Return null to indicate failure gracefully
  }
};


// Helper to format the trading pair symbol
export function formatSymbol(args) {
  try {
    if (args[0].includes('/')) {
      return args[0].toUpperCase();
    } else {
      const baseCurrency = args[0].toUpperCase();
      const quoteCurrency = (args[1] || 'USDT').toUpperCase();
      return `${baseCurrency}/${quoteCurrency}`;
    }
  } catch (error) {
    return 'SOL/USDT'; // Default fallback symbol
  }
}

// Helper to extract the base currency from the trading pair symbol
export function extractBaseCurrency(symbol) {
  return symbol.split('/')[0]; // Extract the base currency before the '/'
}


export function formatMarketCap(marketCapUSD) {
  const marketCap = parseFloat(marketCapUSD);
  if (isNaN(marketCap)) return 'N/A';

  if (marketCap >= 1_000_000_000) {
    return `${(marketCap / 1_000_000_000).toFixed(2)}B`;
  } else if (marketCap >= 1_000_000) {
    return `${(marketCap / 1_000_000).toFixed(2)}M`;
  } else if (marketCap >= 1_000) {
    return `${(marketCap / 1_000).toFixed(2)}K`;
  } else {
    return `${marketCap.toFixed(2)}`;
  }
}
