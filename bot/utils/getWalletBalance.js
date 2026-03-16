// utils/getWalletBalance.js

import { PublicKey } from '@solana/web3.js';
import { connection } from '../private/private.js';

export async function getWalletBalance(referrerWithdrawWallet) {
    try {
        const publicKey = new PublicKey(referrerWithdrawWallet);
        const balance = await connection.getBalance(publicKey);
        return balance / 1e9;
    } catch (error) {
        console.error('Failed to fetch wallet balance:', error.message);
        return null;
    }
}
