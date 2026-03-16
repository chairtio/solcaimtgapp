import fetch from 'node-fetch';
import { PublicKey } from '@solana/web3.js';
import { initSdk } from './config.js';
import pTimeout from '../../utils/pTimeout.js';
import { connection } from '../../private/private.js';

const SOL_MINT_ADDRESS = new PublicKey('So11111111111111111111111111111111111111112');

// Function to convert BN to float with dynamic decimal places
const formatBN = (bn, decimals) => {
  const str = bn.toString();
  const integerPart = str.slice(0, -decimals) || '0';
  const decimalPart = str.slice(-decimals).padStart(decimals, '0');
  return `${integerPart}.${decimalPart}`;
};

// Function to get token account balance
const getTokenAccountBalance = async (vaultPublicKey) => {
  try {
    const accountInfo = await connection.getTokenAccountBalance(new PublicKey(vaultPublicKey));
    return accountInfo.value.uiAmount || 0; // Return balance in the token's native format
  } catch (error) {
    console.error(`Error fetching balance for ${vaultPublicKey}:`, error);
    return 0;
  }
};

export async function fetchPoolInfo(poolId, mintAddressStr) {
  try {
    const raydium = await initSdk();
    let poolInfo, pool;
    let usedLiquidityAPI = false;
    let usedCpmmAPI = false;
    let usedClmmAPI = false;

    // Attempt to fetch using Liquidity API (AMM)
    try {
      poolInfo = await raydium.liquidity.getRpcPoolInfos([poolId]);
      pool = poolInfo[poolId];
      usedLiquidityAPI = true;
    } catch (error) {
      // console.error('Error fetching from Liquidity API:', error.message);
    }

    if (!pool) {
      // Attempt to fetch using CPMM API
      try {
        poolInfo = await raydium.cpmm.getRpcPoolInfos([poolId]);
        pool = poolInfo[poolId];
        usedCpmmAPI = true;
      } catch (error) {
        // console.error('Error fetching from CPMM API:', error.message);
      }
    }

    if (!pool) {
      // Attempt to fetch using CLMM API
      try {
        poolInfo = await raydium.clmm.getRpcClmmPoolInfos({ poolIds: [poolId] });
        pool = poolInfo[poolId];
        usedClmmAPI = true;
      } catch (error) {
        // console.error('Error fetching from CLMM API:', error.message);
      }
    }

    if (pool) {
      let mintA, mintB, mintAAmount, mintBAmount, poolPrice, mintADecimal, mintBDecimal;

      if (usedLiquidityAPI) {
        // AMM-specific fields
        mintADecimal = parseInt(pool.baseDecimal.toString());
        mintBDecimal = parseInt(pool.quoteDecimal.toString());
        mintAAmount = formatBN(pool.mintAAmount, mintADecimal);
        mintBAmount = formatBN(pool.mintBAmount, mintBDecimal);
        poolPrice = parseFloat(pool.poolPrice) || 0;

        mintA = new PublicKey(pool.baseMint.toBase58());
        mintB = new PublicKey(pool.quoteMint.toBase58());

      } else if (usedCpmmAPI) {
        // CPMM-specific fields
        mintADecimal = pool.mintDecimalA;
        mintBDecimal = pool.mintDecimalB;
        mintAAmount = formatBN(pool.vaultAAmount, pool.mintDecimalA);
        mintBAmount = formatBN(pool.vaultBAmount, pool.mintDecimalB);
        poolPrice = parseFloat(pool.poolPrice) || 0;

        mintA = new PublicKey(pool.mintA.toBase58());
        mintB = new PublicKey(pool.mintB.toBase58());

      } else if (usedClmmAPI) {
        // CLMM-specific fields
        mintADecimal = pool.mintDecimalsA;
        mintBDecimal = pool.mintDecimalsB;
        [mintAAmount, mintBAmount] = await Promise.all([
          pTimeout(getTokenAccountBalance(pool.vaultA.toBase58()), 10000),
          pTimeout(getTokenAccountBalance(pool.vaultB.toBase58()), 10000)
        ]);
        poolPrice = parseFloat(pool.currentPrice) || 0;

        mintA = new PublicKey(pool.mintA.toBase58());
        mintB = new PublicKey(pool.mintB.toBase58());

      } else {
        throw new Error('Unsupported pool type or missing data');
      }

      if (mintA.equals(SOL_MINT_ADDRESS)) {
        // mintA is SOL
        const baseAmountSOL = mintAAmount;
        return {
          baseAmountSOL,
          adjustedPoolPrice: poolPrice,
        };
      } else if (mintB.equals(SOL_MINT_ADDRESS)) {
        // mintB is SOL
        const baseAmountSOL = mintBAmount;
        return {
          baseAmountSOL,
          adjustedPoolPrice: 1 / (poolPrice || 1),
        };
      } else {
        // Fetch prices for mintA and mintB if neither is SOL
        const [mintAPriceInSOL, mintBPriceInSOL] = await Promise.all([
          pTimeout(getTokenPriceInSOL(mintA), 10000),
          pTimeout(getTokenPriceInSOL(mintB), 10000)
        ]);

        // Determine the token price based on mintAddressStr
        let tokenPrice;
        if (mintA.toBase58() === mintAddressStr) {
          tokenPrice = mintAPriceInSOL;
          // console.log(`Token price for mintA (${mintAddressStr}):`, mintAPriceInSOL);
        } else if (mintB.toBase58() === mintAddressStr) {
          tokenPrice = mintBPriceInSOL;
          // console.log(`Token price for mintB (${mintAddressStr}):`, mintBPriceInSOL);
        } else {
          console.error(`mintAddressStr (${mintAddressStr}) does not match either mintA or mintB.`);
          return null;
        }

        // Calculate liquidity only if both prices are available
        let liq = 0;
        if (mintAPriceInSOL > 0 && mintBPriceInSOL > 0) {
          liq = mintAPriceInSOL * mintAAmount + mintBPriceInSOL * mintBAmount;
        }

        return {
          adjustedPoolPrice: 1 / tokenPrice,
          tokenPriceSol: tokenPrice,
          liq,
        };
      }
    } else {
      return {
        baseAmountSOL,
        adjustedPoolPrice: poolPrice || 0,
      };
    }
  } catch (error) {
    console.error('Error fetching pool info:', error.message);
    return null;
  }
}


// Function to get token price in SOL using Jupiter API
const getTokenPriceInSOL = async (mintAddress) => {
  try {
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${mintAddress.toBase58()}&vsToken=So11111111111111111111111111111111111111112`);
    const data = await response.json();
    const price = data.data[mintAddress.toBase58()]?.price || 0;
    return price;
  } catch (error) {
    console.error(`Error fetching SOL price for ${mintAddress.toBase58()}:`, error);
    return 0;
  }
};
