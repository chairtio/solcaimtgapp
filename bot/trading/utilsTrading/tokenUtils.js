// trading/utilsTrading/tokenUtils.js

import { getMint } from '@solana/spl-token';
import { connection } from '../../private/private.js';
import { PublicKey, LAMPORTS_PER_SOL, AddressLookupTableAccount, SystemProgram } from '@solana/web3.js';
import pTimeout from '../../utils/pTimeout.js';

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidMintAddress(address) {
  return typeof address === 'string' && SOLANA_ADDRESS_REGEX.test(address);
}

export async function getMintInfo(mintAddressStr) {
  try {
      const mintAddress = new PublicKey(mintAddressStr);

      // Fetch account info for a single token account
      const accountInfo = await connection.getParsedAccountInfo(mintAddress);
      
      // Debug: log the accountInfo structure
      // console.log("Account Info Response:", JSON.stringify(accountInfo, null, 2));

      // Check if the account info is available
      if (accountInfo.value) {
          const parsedInfo = accountInfo.value.data.parsed.info;

          // Return the desired fields
          return {
              mintAuthority: parsedInfo.mintAuthority,
              supply: parsedInfo.supply,
              decimals: parsedInfo.decimals,
              isInitialized: parsedInfo.isInitialized,
              freezeAuthority: parsedInfo.freezeAuthority,
          };
        } else {
          // console.warn("No valid account info available for the given mint address.");
          return null; // Or handle this case as needed
        }
  } catch (error) {
      // console.error('Error fetching account info:', error);
      return null;
  }
}
//
export async function getTokenBalance(userPublicKey, mintAddressStr, decimals) {
  try {
    const userAddress = new PublicKey(userPublicKey);
    const mintAddress = new PublicKey(mintAddressStr);

    // Fetch all token accounts for the wallet
    const response = await pTimeout(
      connection.getParsedTokenAccountsByOwner(userAddress, { mint: mintAddress }),
      10000 // Timeout in milliseconds
    );

    // Find the token account with the specified mint address
    const tokenAccount = response.value.find(tokenAccount => {
      const accountMint = new PublicKey(tokenAccount.account.data.parsed.info.mint);
      return accountMint.equals(mintAddress);
    });

    if (!tokenAccount) {
      // No token account found for the given mint address
      return 0;
    }

    const amount = tokenAccount.account.data.parsed.info.tokenAmount.amount;
    const balance = amount / (10 ** decimals);

    return balance;
  } catch (error) {
    console.error('Error fetching Token balance:', error.message);
    return 0;
  }
}

export async function getUserSOLBalance(userpublicKey) {
  try {
    const balance = await connection.getBalance(new PublicKey(userpublicKey));
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error fetching SOL balance:', error.message);
    return 0; // Default to 0 if there's an error
  }
}
export async function fetchTokenDecimals(mintAddress) {
  try {
    const tokenMintPublicKey = new PublicKey(mintAddress);
    const tokenInfo = await connection.getTokenSupply(tokenMintPublicKey);
    return tokenInfo.value.decimals;
  } catch (error) {
    console.error('Error fetching token decimals:', error);
    return 0; // Default to 0 if there's an error
  }
}
export function calculateRelativeTime(pairCreatedAt) {
  if (!pairCreatedAt) return 'N/A';

  const now = Date.now();
  const createdAt = new Date(pairCreatedAt).getTime();
  const diffInSeconds = Math.floor((now - createdAt) / 1000);

  const seconds = Math.floor(diffInSeconds % 60);
  const minutes = Math.floor(diffInSeconds / 60 % 60);
  const hours = Math.floor(diffInSeconds / 3600 % 24);
  const days = Math.floor(diffInSeconds / 86400);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months}mo`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function formatLiquidity(liquidityUSD) {
  const liquidity = parseFloat(liquidityUSD);
  if (isNaN(liquidity)) return 'N/A';

  if (liquidity >= 1_000_000_000) {
    return `$${(liquidity / 1_000_000_000).toFixed(2)}B`;
  } else if (liquidity >= 1_000_000) {
    return `$${(liquidity / 1_000_000).toFixed(2)}M`;
  } else if (liquidity >= 1_000) {
    return `$${(liquidity / 1_000).toFixed(2)}K`;
  } else {
    return `$${liquidity.toFixed(2)}`;
  }
}

export function formatVolume(volume) {
  const vol = parseFloat(volume);
  
  if (isNaN(vol) || volume === 'N/A') {
    return `$0.00`;
  }
  if (vol >= 1_000_000_000) {
    return `$${(vol / 1_000_000_000).toFixed(2)}B`;
  } else if (vol >= 1_000_000) {
    return `$${(vol / 1_000_000).toFixed(2)}M`;
  } else if (vol >= 1_000) {
    return `$${(vol / 1_000).toFixed(2)}K`;
  } else {
    return `$${vol.toFixed(2)}`;
  }
}

export function formatMarketCap(marketCapUSD) {
  const marketCap = parseFloat(marketCapUSD);
  if (isNaN(marketCap)) return 'N/A';

  if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toFixed(2)}B`;
  } else if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toFixed(2)}M`;
  } else if (marketCap >= 1_000) {
    return `$${(marketCap / 1_000).toFixed(2)}K`;
  } else {
    return `$${marketCap.toFixed(2)}`;
  }
}

export function formatTVL(tvl) {
  const tvlUSD = parseFloat(tvl);
  if (isNaN(tvlUSD)) return 'N/A';

  if (tvlUSD >= 1_000_000_000) {
    return `$${(tvlUSD / 1_000_000_000).toFixed(2)}B`;
  } else if (tvlUSD >= 1_000_000) {
    return `$${(tvlUSD / 1_000_000).toFixed(2)}M`;
  } else if (tvlUSD >= 1_000) {
    return `$${(tvlUSD / 1_000).toFixed(2)}K`;
  } else {
    return `$${tvlUSD.toFixed(2)}`;
  }
}

export function escapeMarkdownV2(text) {
  if (typeof text !== 'string') {
    return text; 
  }
  // return text.replace(/[[\]()~>#+\-=|{}.!]/g, '\\$&');
  return text.replace(/[[\]()~>#+\-=|{}.!_\\]/g, '\\$&');

}

export function formatAmountToken(marketCapUSD) {
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


export async function getTokenBalances(userPublicKeys, mintAddressStr, decimals) {
  try {
      const mintAddress = new PublicKey(mintAddressStr);
      const results = {};
  
      for (const userPublicKey of userPublicKeys) {
          const userAddress = new PublicKey(userPublicKey);
  
          // Fetch all token accounts for the wallet
          const response = await pTimeout(
          connection.getParsedTokenAccountsByOwner(userAddress, { mint: mintAddress }),
          10000 // Timeout in milliseconds
          );
  
          // Find the token account with the specified mint address
          const tokenAccount = response.value.find(tokenAccount => {
          const accountMint = new PublicKey(tokenAccount.account.data.parsed.info.mint);
          return accountMint.equals(mintAddress);
          });
  
          if (tokenAccount) {
          const amount = tokenAccount.account.data.parsed.info.tokenAmount.amount;
          const balance = amount / (10 ** decimals);
          results[userPublicKey] = balance;
          } else {
          // No token account found for the given mint address
          results[userPublicKey] = 0;
          }
      }
      return results;
  } catch (error) {
    console.error('Error fetching Token balances:', error.message);
    return {}; // Return an empty object in case of error
  }
}


// Function to create SOL transfer instruction
export const createSolTransferInstruction = (fromPubkey, toPubkey, amountLamports) => {
  return SystemProgram.transfer({
    fromPubkey: fromPubkey,
    toPubkey: toPubkey,
    lamports: amountLamports,
  });
};

// Function to get address lookup table accounts
export const getAddressLookupTableAccounts = async (keys) => {
  const addressLookupTableAccountInfos = await connection.getMultipleAccountsInfo(
    keys.map((key) => new PublicKey(key))
  );

  return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
    const addressLookupTableAddress = keys[index];
    if (accountInfo) {
      const addressLookupTableAccount = new AddressLookupTableAccount({
        key: new PublicKey(addressLookupTableAddress),
        state: AddressLookupTableAccount.deserialize(accountInfo.data),
      });
      acc.push(addressLookupTableAccount);
    }
    return acc;
  }, []);
};
