import fetch from 'node-fetch';

// Function to get the first pool
export async function dexscreenerAllpool(mintAddressStr) {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mintAddressStr}`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        // Check if data contains pairs
        if (!data.pairs || data.pairs.length === 0) {
            // console.log('No pairs found for the given mint address.');
            return null;
        }

        // Get the first pool in the list
        const firstPool = data.pairs[0];

        // Return details of the first pool
        const { priceUsd, priceNative, baseToken: { name, symbol }, priceChange, liquidity: {usd} } = firstPool;
        return {
            name: name,
            symbol: symbol,
            tokenPrice: priceUsd,
            solVsToken: 1/priceNative,
            priceChange,
            tvl: usd
        };

    } catch (error) {
      if (error.message.includes(`Cannot read properties of undefined (reading 'usd')`)) {
      } else {
      console.error('Error fetching pool data from Dexscreener:', error.message);
    }
    return null;
  }
}
