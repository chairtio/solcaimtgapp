import fetch from 'node-fetch';

// Combined function to get pool data from Dexscreener
export async function fetchDexscreenerData(mintAddressStr) {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mintAddressStr}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Check if data contains pairs
        if (!data.pairs || data.pairs.length === 0) {
            return null;
        }

        // Try to get Raydium pairs
        const raydiumPairs = data.pairs.filter(pair => 
            pair.dexId === 'raydium' && pair.baseToken.address === mintAddressStr
        );

        if (raydiumPairs.length > 0) {
            const { pairAddress, baseToken: { name, symbol }, priceChange } = raydiumPairs[0];
            return {
                id: pairAddress,
                name: name,
                symbol: symbol,
                priceChange
            };
        }

        // Fallback to the first pool in the list
        const firstPool = data.pairs[0];
        const { priceUsd, priceNative, baseToken: { name, symbol }, priceChange, liquidity } = firstPool;
        const tvl = liquidity ? liquidity.usd : 0;

        return {
            name: name,
            symbol: symbol,
            tokenPrice: priceUsd,
            solVsToken: 1 / priceNative,
            priceChange,
            tvl
        };

    } catch (error) {
        console.error('Error fetching pool data from Dexscreener:', error.message);
        return null;
    }
}
