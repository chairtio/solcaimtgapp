import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { PublicKey } from '@solana/web3.js';
import { connection } from '../../private/private.js';

// Create Umi instance with Metaplex Token Metadata
const umi = createUmi(connection).use(mplTokenMetadata());

export async function getMetaplex(mintAddress) {
    try {
        // Convert the mint address to a PublicKey
        const mintPublicKey = new PublicKey(mintAddress);

        // Fetch the digital asset using the mint address
        const asset = await fetchDigitalAsset(umi, mintPublicKey);

        // Extract relevant information
        const mintInfo = {
            decimals: asset.mint.decimals,
            freezeAuthority: asset.mint.freezeAuthority.__option === 'Some' ? asset.mint.freezeAuthority.value : null,
            isInitialized: asset.mint.isInitialized,
            mintAuthority: asset.mint.mintAuthority.__option === 'Some' ? asset.mint.mintAuthority.value : null,
            supply: asset.mint.supply.toString(),
        };
        
        const isPumpfun = asset.metadata.updateAuthority === 'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM';

        // Return structured data
        return {
            mintInfo,
            name: asset.metadata.name,
            symbol: asset.metadata.symbol,
            isPumpfun,
        };
    } catch (error) {
        // console.error('Error fetching metaplex metadata:', error.message);
        return {}; // Return null in case of error
    }
}

// const mintAddress = '3ddNdaMysf9vt8z3SGjARN3sVMcrrhSsZUKQpwiGpump';
// getNftMetadata(mintAddress).then(console.log)
