import { PublicKey, SystemProgram } from '@solana/web3.js';
import { connection } from '../private/private.js';

export async function checkAddressType(addressStr) {
    try {
        const address = new PublicKey(addressStr);
        const accountInfo = await connection.getAccountInfo(address);

        if (accountInfo) {
            // Check if the account is owned by the System Program
            if (accountInfo.owner.equals(SystemProgram.programId)) {
                return 'Wallet Address';
            }

            // If not owned by the System Program, assume it's a token address
            return 'Token Mint Address';
        } else {
            return 'Invalid Address';
        }
    } catch (e) {
        // console.error('Error checkaddresstype:', e.message);
        return 'Error';
    }
}

