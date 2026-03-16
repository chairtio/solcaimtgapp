import pTimeout from '../../utils/pTimeout.js';
import fetch from 'node-fetch';

export const fetchSolPrice = async () => {
    try {
        const apiURL = 'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112';

        // const apiURL = 'https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112';
        
        const response = await pTimeout(fetch(apiURL), 10000);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const solPrice = parseFloat(data.data['So11111111111111111111111111111111111111112']?.price) || 0;
  
        return solPrice;
  
    } catch (error) {
        console.error('Error fetching SOL price:', error.message);
        return 0;
    }
};

export const getMultiTokenDetailsJup = async (mintAddresses) => {
    try {
        // Construct URL with multiple token addresses, without SOL address
        const mintIds = mintAddresses.join(',');
        const apiURL = `https://api.jup.ag/price/v2?ids=${mintIds}`;
  
        const response = await pTimeout(fetch(apiURL), 10000);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        
        // Fetch additional info (symbols) for each mint address if needed
        const tokenDetails = mintAddresses.map(mint => {
            const priceInfo = data.data[mint] || {};
            return {
                mint,
                symbol: priceInfo.mintSymbol || 'Unknown',
                price: parseFloat(priceInfo.price) || '',
            };
        });
  
        return tokenDetails;
  
    } catch (error) {
        console.error('Error fetching token details from JUP:', error.message);
        return [];
    }
};
  
//   getTokenDetailsJup(
//     ['59uAUbCEPmoFTZMohECdk7y2YZaYqKCMFWoECcKbpump', '4sp2EUDrQf46rZun6sYAWzjrXwUpx2T3njuoKmV766RJ']
//   ).then(console.log)
