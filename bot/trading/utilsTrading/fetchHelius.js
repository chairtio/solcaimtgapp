import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { apiKeyHelius } from "../../private/private.js";
import pTimeout from '../../utils/pTimeout.js';
import { fetchSolPrice, getMultiTokenDetailsJup } from "./fetchJupiter.js";
import { findMultipleBondingCurveAccounts } from "./pumpfun.js";
import { urlTokenData } from "../../private/private.js";

const url = `https://mainnet.helius-rpc.com/?api-key=${apiKeyHelius}`;

export const searchAssetsTokenInfo = async (publicKey, mintAddresses, hideToken = false) => {
    try {
        const solPrice = await fetchSolPrice();
        // console.log('SOL Price:', solPrice);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'my-id',
                method: 'searchAssets',
                params: {
                    ownerAddress: publicKey,
                    tokenType: 'fungible',
                    displayOptions: {
                        showNativeBalance: true,
                    },
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }

        const { result } = await response.json();
        // console.log('Helius API result:', result);

        // Extract token and native balance details
        const tokens = result.items.map(item => {
            const pumpfun = 'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM';
            const tokenAddress = item?.id;
            const tokenInfo = item?.token_info;
            const authorities = item?.authorities[0]?.address;
            const isPumpfun = authorities === pumpfun;
            const symbol1 = item?.content?.metadata?.symbol;
            const name = item?.content?.metadata?.name || 'Unknown';
            const symbol2 = tokenInfo?.symbol;
            const symbol = symbol1 || symbol2 || 'Unknown';
            const decimals = tokenInfo?.decimals || NaN;
            const supply = Number(tokenInfo?.supply) / (10 ** decimals);
            const balanceToken = tokenInfo?.balance / (10 ** decimals);
            const priceToken = tokenInfo?.price_info?.price_per_token || '';
            const totalValueUSD = tokenInfo?.price_info?.total_price || '';
            const ata = tokenInfo?.associated_token_address;

            return {
                tokenAddress,
                symbol,
                name,
                decimals,
                supply,
                balanceToken,
                priceToken,
                totalValueUSD,
                authorities,
                isPumpfun,
                ata,
            };
        });

        // Filter tokens to keep only those in the provided mintAddresses list
        const filteredTokens = tokens.filter(token => mintAddresses.includes(token.tokenAddress));

        // Extract mint addresses from filtered tokens
        const filteredMintAddresses = filteredTokens.map(token => token.tokenAddress);

        // Fetch missing price info from JUP API
        if (filteredMintAddresses.length > 0) {
            const mintAddresses100 = filteredMintAddresses.slice(0, 100); // Take up to 100 tokens
            const tokenDetails = await pTimeout(getMultiTokenDetailsJup(mintAddresses100), 10000);
            // console.log('JUP Token Details:', tokenDetails);

            // Update filtered tokens with price info from JUP API
            filteredTokens.forEach(token => {
                const jupToken = tokenDetails.find(jup => jup.mint === token.tokenAddress);
                if (jupToken) {
                    token.priceToken = jupToken.price;
                    token.totalValueUSD = (token.balanceToken * jupToken.price) || '';
                }
            });
        }

        // Check if any pumpfun tokens still lack price info
        const missingPricePumpfunTokens = filteredTokens.filter(token => token.isPumpfun && !token.priceToken);

        if (missingPricePumpfunTokens.length > 0) {
            const mintAddressesForBondingCurve = missingPricePumpfunTokens.map(token => new PublicKey(token.tokenAddress));
            const mintAddressesForBondingCurve50 = mintAddressesForBondingCurve.slice(0, 50); // Take up to 50 tokens

            const bondingCurveData = await pTimeout(findMultipleBondingCurveAccounts(mintAddressesForBondingCurve50), 10000);
            // console.log('Bonding Curve Data:', bondingCurveData);

            // Map bonding curve results by mint address
            const bondingCurvePriceMap = new Map(bondingCurveData.map(data => [data.mintAddress, data.price]));

            // Update only the tokens that were missing price info
            missingPricePumpfunTokens.forEach(token => {
                const price = bondingCurvePriceMap.get(token.tokenAddress);
                if (price) {
                    token.priceToken = price;
                    token.totalValueUSD = (token.balanceToken * price * solPrice) || 0;
                }
            });
        }

        // Apply hideToken filter after all price information has been fetched
        const finalTokens = hideToken
            ? filteredTokens.filter(token => token.totalValueUSD > 1)
            : filteredTokens;

        return { tokens: finalTokens, solPrice: solPrice };

    } catch (error) {
        console.error('Error fetching asset data:', error);
        return { tokens: [], solPrice: 0 };
    }
};

// searchAssetsTokenInfo('GoodLUxqVUAH6AaqHq2soCXiJCSeP4CoeFg5AEu1bxq7', ['59uAUbCEPmoFTZMohECdk7y2YZaYqKCMFWoECcKbpump', '7atgF8KQo4wJrD5ATGX7t1V2zVvykPJbFfNeVf1icFv1'], true).then(console.log);



export async function getMintDataHelius(mintAddress) {
    try {
        const response = await fetch(url, {
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
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}. Response: ${errorText}`);
        }

        const { result } = await response.json();
        // console.log("Fetched data:", result);

        // Extracting authorities and supply info
        const supply = result.token_info?.supply || null;
        const decimals = result.token_info?.decimals || null;

        // Other metadata fields
        const freezeAuthority = result.ownership?.frozen || false;  // Ownership frozen status
        const mintAuthority = result.mutable || false;  // Whether the token is mutable

        const name = result.content?.metadata?.name || '';
        const symbol = result.content?.metadata?.symbol || '';
        const isPumpfun = result.authorities[0].address === 'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM';

        return {
            mintInfo: {
                mintAuthority,
                freezeAuthority,
                supply,
                decimals
            },
            name,
            symbol,
            isPumpfun
        };
    } catch (error) {
        console.error("Error fetching token metadata: ", error.message);
        return {};
    }
}

// getMintDataHelius('RAPRz9fd87y9qcBGj1VVqUbbUM6DaBggSDA58zc3N2b').then(console.log);
