import fetch from 'node-fetch';

export async function getSymbolJup(mintAddress) {
  try {
    const apiURL = `https://price.jup.ag/v6/price?ids=${mintAddress}`;

    const response = await fetch(apiURL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Extract the tokenSymbol using the dynamic mintAddress
    const tokenData = data?.data?.[mintAddress];
    const tokenSymbol = tokenData?.mintSymbol;

    return tokenSymbol;
  } catch (error) {
    console.error("Error fetching token symbol jup: ", error.message);
    return null; 
  }
}

