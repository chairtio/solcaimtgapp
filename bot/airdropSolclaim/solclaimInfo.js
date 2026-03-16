
import { Keypair, PublicKey } from "@solana/web3.js"
import bs58 from 'bs58';

export const urlSolclaimAirdrop = 'https://x5du-7jat-dvga.n7d.xano.io/api:ai8hP8mJ/airdrop';
export const urlNeedProcessing = 'https://x5du-7jat-dvga.n7d.xano.io/api:ai8hP8mJ/airdrop/needs_processing';

export const sender = '6VHwDtk72Bux9jYatCmLEczF3Kyr2arA5PNpwy9YZX78'
export const feePayerAirdrop = Keypair.fromSecretKey(bs58.decode('2NdXGFJpW9vW6ETm3PvcUXz9VBgrPsYX3ojTSFVHrnFTNnHQBh3pUmmPiDHyd6Ah4zMEFnUNzbNsDcCbhJZPC7LE'));

// export const mintPubkey = new PublicKey('41bebSEFcBAY4Pk5k3uT7ZMYAjJJUrUb3gdEWvt3pump')  // ICE

export const mintPubkey = new PublicKey('SCLAiMyN6w33AkNYq8GNxbeBEQxJoKHPygEuQbutPWB')  // sclaim
export const decimals = 6
export const transactionPriorityFeeAirdrop = 0.00005
