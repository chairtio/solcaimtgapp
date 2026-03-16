// storeMap/checkClaim.js

import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { connection, redis } from "../private/private.js";

export async function checkClaim(address, userId) {
    try {
        // Fetch token data and save to Redis
        const owner = new PublicKey(address);
        const response = await connection.getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_PROGRAM_ID,
        });
        // console.log(response)
        const tokenAccounts = [];
        let zeroAmountAccountsCount = 0;

        for (const tokenAccount of response.value) {
            const pubkey = new PublicKey(tokenAccount.pubkey);
            const account = tokenAccount.account;
            const mint = account.data.parsed.info.mint;
            const decimals = account.data.parsed.info.tokenAmount.decimals;
            const amount = account.data.parsed.info.tokenAmount.amount / (10 ** decimals);

            if (amount === 0) {
                zeroAmountAccountsCount++;
            }

            tokenAccounts.push({ pubkey, mint, decimals, amount });
        }

        // Store the token accounts data in Redis temporarily
        await redis.set(userId, JSON.stringify({ tokenAccounts, zeroAmountAccountsCount, timestamp: Date.now() }));

        return {
            message: `Token data saved for user ${userId}`,
            tokenAccountsCount: response.value.length,
            zeroAmountAccountsCount
        };
    } catch (error) {
        console.error("Error check claim:", error);
        return {
            message: "An error occurred while fetching token accounts.",
            tokenAccountsCount: 0,
            zeroAmountAccountsCount: 0
        };
    }
}

export async function getTokenData(userId) {
    try {
        const data = await redis.get(userId);
        if (data) {
            return JSON.parse(data);
        } else {
            return { tokenAccounts: [], zeroAmountAccountsCount: 0 };
        }
    } catch (error) {
        console.error('Error retrieving token data:', error);
        return { tokenAccounts: [], zeroAmountAccountsCount: 0 };
    }
}

export async function clearTokenData(userId) {
    try {
        await redis.del(userId);
    } catch (error) {
        console.error('Error clearing token data:', error);
    }
}
