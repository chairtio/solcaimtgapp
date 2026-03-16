import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {connection } from "../../private/private.js";
import pTimeout from '../../utils/pTimeout.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { lusolve } from 'mathjs';

const totalSupply = 999999999;
const tokenForSell = 793099999;
const noSellTokens = totalSupply - tokenForSell;

// Data points for quadratic regression
const points = [
    { sol: 60.613, price: 0.0000002551 },
    { sol: 13.74, price: 0.0000000594 },
    { sol: 44.567, price: 0.0000001727 }
];

// Set up matrices A and B for quadratic regression
const A = points.map(p => [p.sol * p.sol, p.sol, 1]);
const B = points.map(p => p.price);

// Solve for coefficients [a, b, c]
const coeffs = lusolve(A, B);

// Extract coefficients
const [a, b, c] = coeffs.flat();

// Function to calculate price based on SOL in the pool
function calculatePrice(solInPool) {
    return a * solInPool * solInPool + b * solInPool + c;
}

// Function to fetch bonding curve data for multiple mint addresses
export async function findMultipleBondingCurveAccounts(mintAddresses) {
    try {
        const PUMP_PROGRAM_ADDRESS = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

        // Derive the Bonding Curve Account and Associated Token Account for each mint address
        const bondCurveAccountsPromises = mintAddresses.map(async mintAddress => {
            const [bondingCurveAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("bonding-curve"), mintAddress.toBytes()],
                PUMP_PROGRAM_ADDRESS
            );
            const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
                [bondingCurveAccount.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintAddress.toBuffer()],
                ASSOCIATED_TOKEN_PROGRAM_ID
            );
            return { mintAddress, bondingCurveAccount, associatedBondingCurve };
        });

        const bondCurveAccounts = await pTimeout(Promise.all(bondCurveAccountsPromises), 10000);

        // Fetch token account infos and SOL balances using getMultipleParsedAccounts
        const publicKeys = bondCurveAccounts.flatMap(({ bondingCurveAccount, associatedBondingCurve }) => [
            bondingCurveAccount, associatedBondingCurve
        ]);

        const accountInfos = await connection.getMultipleParsedAccounts(publicKeys);

        const results = [];

        for (let i = 0; i < bondCurveAccounts.length; i++) {
            const { mintAddress } = bondCurveAccounts[i];

            const bondingCurveInfo = accountInfos.value[i * 2];
            const associatedBondingCurveInfo = accountInfos.value[i * 2 + 1];

            if (!bondingCurveInfo || !associatedBondingCurveInfo) {
                console.error(`Missing data for mintAddress: ${mintAddress.toBase58()}`);
                continue;
            }

            const solBalance = bondingCurveInfo?.lamports / 1e9 || 0; // Convert lamports to SOL

            // Calculate price based on SOL balance
            const price = calculatePrice(solBalance);

            results.push({
                mintAddress: mintAddress.toBase58(),
                price,
            });
        }

        return results;

    } catch (error) {
        console.error('Error fetching bonding curve Accounts:', error.message);
        return [];
    }
}

export async function findBondingCurveAccount(mintAddress) {
    try {
        const PUMP_PROGRAM_ADDRESS = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
        const mintAddressPub = new PublicKey(mintAddress);

        // Derive the Bonding Curve Account address
        const [bondingCurveAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("bonding-curve"), mintAddressPub.toBytes()],
            PUMP_PROGRAM_ADDRESS
        );
        const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
            [bondingCurveAccount.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintAddressPub.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Fetch data for both accounts
        const publicKeys = [bondingCurveAccount, associatedBondingCurve];
        const { value: accountInfos } = await connection.getMultipleParsedAccounts(publicKeys);

        if (!accountInfos || accountInfos.length < 2) {
            throw new Error("Failed to fetch account information pumpfun.");
        }

        // Extract SOL balance from bonding curve account info
        const bondingCurveInfo = accountInfos[0];
        const solBalance = bondingCurveInfo.lamports / LAMPORTS_PER_SOL; // Convert lamports to SOL

        // Extract token balance from associated token account info
        const associatedBondingCurveInfo = accountInfos[1];
        if (!associatedBondingCurveInfo || !associatedBondingCurveInfo.data || !associatedBondingCurveInfo.data.parsed) {
            throw new Error("Associated token account info not found or invalid pumpfun.");
        }
        const tokenBalance = associatedBondingCurveInfo.data.parsed.info.tokenAmount.uiAmount;

        // Calculate the token price based on the SOL balance
        const price = calculatePrice(solBalance);

        // Calculate bonding progress
        const tokenLeft = tokenBalance - noSellTokens;
        const tokenSold = tokenForSell - tokenLeft;
        let bondingProgress = (tokenSold / tokenForSell) * 100;
        
        // Cap the bonding progress at 100%
        bondingProgress = Math.min(bondingProgress, 100);

        return {
            tokenBalance,
            solBalance,
            price,
            bondingProgress
        };

    } catch (error) {
        console.error('Error finding bonding curve Account pumpfun:', error.message);
        return {};
    }
}
