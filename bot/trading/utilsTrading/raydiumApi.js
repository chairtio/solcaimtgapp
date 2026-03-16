import fetch from 'node-fetch';

// Function to get Raydium pair details
export async function getRaydiumPairDetails(mintAddressStr) {
    const url = `https://api-v3.raydium.io/pools/info/mint?mint1=${mintAddressStr}&mint2=So11111111111111111111111111111111111111112&poolType=standard&poolSortField=liquidity&sortType=desc&pageSize=1&page=1`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.data.count > 0) {
        const pool = data.data.data[0];
        
        const isMintA = pool.mintA.address === mintAddressStr;
        const mintInfo = isMintA ? pool.mintA : pool.mintB;

        return {
            id: pool.id,
            symbol: mintInfo.symbol,
            name: mintInfo.name,
            // priceMin: pool.day.priceMin,
            // priceMax: pool.day.priceMax,
        };
      }
    } catch (error) {
      console.error('Error fetching Raydium pool data:', error.message);
    }

    // Return an empty object if no data found or an error occurred
    return null;
}
