import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { connection } from "../private/private.js";

// Function to check if a wallet address is valid
const isValidWalletAddress = (address) => {
    try {
        new PublicKey(address); // Validate wallet address format
        return true;
    } catch {
        return false;
    }
};

export const checkTokenHolding = async (walletAddress, mintAddress, minAmount) => {
    // Validate the wallet address before proceeding
    if (!isValidWalletAddress(walletAddress)) {
        return null; // Return null for invalid wallet address
    }

    try {
        const owner = new PublicKey(walletAddress);
        const specificMintAddress = new PublicKey(mintAddress);
        const response = await connection.getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_PROGRAM_ID,
        });

        for (const tokenAccount of response.value) {
            const account = tokenAccount.account;
            const mint = new PublicKey(account.data.parsed.info.mint);
            const decimals = account.data.parsed.info.tokenAmount.decimals;
            const amount = account.data.parsed.info.tokenAmount.amount / (10 ** decimals);

            if (mint.equals(specificMintAddress) && amount >= minAmount) {
                return true; // Holder has enough tokens
            }
        }

        return false; // Not enough tokens found
    } catch (error) {
        console.error("Error checktokenholding server:", error.message);
        return null; // Return null on error
    }
};
