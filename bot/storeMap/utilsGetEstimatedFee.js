
import { apiKeyHelius } from "../private/private.js";
import bs58 from 'bs58';

export async function getPriorityFeeEstimateHelius(transaction) {
    const HeliusURL = `https://mainnet.helius-rpc.com/?api-key=${apiKeyHelius}`;
    const priorityLevel = 'Low';

    try {
        const response = await fetch(HeliusURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "1",
                method: "getPriorityFeeEstimate",
                params: [
                    {
                        transaction: bs58.encode(transaction.serialize()),
                        options: { priorityLevel: priorityLevel },
                    },
                ],
            }),
        });

        if (!response.ok) {
            return 0
        }

        const data = await response.json();

        return data.result.priorityFeeEstimate;

    } catch (error) {
        console.error("Error fetching priority fee estimate:", error.message);
        return 0
    }
}
