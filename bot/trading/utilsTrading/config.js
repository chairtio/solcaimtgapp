import { Raydium, TxVersion } from '@raydium-io/raydium-sdk-v2';
import { connection } from '../../private/private.js';
const txVersion = TxVersion.V0;
const cluster = 'mainnet';

let raydium;

export const initSdk = async () => {
  if (raydium) return raydium;

  raydium = await Raydium.load({
    connection,
    cluster,
    disableFeatureCheck: true,
    blockhashCommitment: 'finalized',
  });
  
  return raydium;
};
