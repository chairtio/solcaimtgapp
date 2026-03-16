import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { connection } from "../private/private.js";

const SOL_CLAIM_PER_TOKEN_ACCOUNT = 0.0015;

// Define the blacklist of wallet addresses
const blacklist = [
    "ZG98FUCjb8mJ824Gbs6RsgVmr1FhXb2oNiJHa2dwmPd",
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL",
    // Add more blacklisted addresses here
];

// Function to check if a wallet address is valid
const isValidWalletAddress = (address) => {
    try {
        new PublicKey(address); // Validate wallet address format
        return true;
    } catch {
        return false;
    }
};

export const checkClaimAPI = async (address) => {
    // Validate the wallet address before proceeding
    if (!isValidWalletAddress(address)) {
        return null; // Return null for invalid wallet address
    }

    try {
        // Check if the wallet address is in the blacklist
        if (blacklist.includes(address)) {
            return null;
        }

        const owner = new PublicKey(address);
        const response = await connection.getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_PROGRAM_ID,
        });

        const tokenAccountsCount = response.value.length;
        let zeroAmountAccountsCount = 0;

        for (const tokenAccount of response.value) {
            const account = tokenAccount.account;
            const amount = account.data.parsed.info.tokenAmount.amount / (10 ** account.data.parsed.info.tokenAmount.decimals);

            if (amount === 0) {
                zeroAmountAccountsCount++;
            }
        }

        const solToClaim = tokenAccountsCount * SOL_CLAIM_PER_TOKEN_ACCOUNT;
        const solAbleToClaim = zeroAmountAccountsCount * SOL_CLAIM_PER_TOKEN_ACCOUNT;

        return {
            wallet: address,
            availableToClaim: solAbleToClaim.toFixed(4),
            burnTokensToClaim: solToClaim > solAbleToClaim ? solToClaim.toFixed(4) : null,
        };
    } catch (error) {
        console.error("Error checkClaimAPI server:", error.message);
        return null;
    }
};
