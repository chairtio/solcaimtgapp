import { apiKeyHelius } from "../../private/private.js"; // Ensure this has your API key in the correct format
const urlGetAsset = `https://mainnet.helius-rpc.com/?api-key=${apiKeyHelius}`;

export async function getTokenData(mintAddress) {
  try {
    const response = await fetch(urlGetAsset, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'my-id',  // Can be any unique string
        method: 'getAsset',
        params: {
          id: mintAddress,  // Use the mint address as the asset ID
          displayOptions: {
            showInscription: true,  // Adjust based on what you need
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text(); // Capture the error response
      throw new Error(`HTTP error! Status: ${response.status}. Response: ${errorText}`);
    }

    const { result } = await response.json();
    // console.log(result)
    // Check for symbol in the metadata returned by getAsset
    const onChainSymbol = result.content?.metadata?.symbol || null;

    // Return the symbol, or null if it doesn't exist
    return onChainSymbol || null;
  } catch (error) {
    // console.error("Error fetching token metadata: ", error.message);
    return null;
  }
}

// Example usage
// getTokenData('RAPRz9fd87y9qcBGj1VVqUbbUM6DaBggSDA58zc3N2b').then(console.log);
