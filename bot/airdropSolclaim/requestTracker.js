import { redis } from "../private/private.js";

export const readProcessedRequests = async () => {
    try {
        const data = await redis.get('processed_requests');
        return data ? JSON.parse(data) : {}; // Parse JSON or return empty object if not found
    } catch (error) {
        console.error('Error reading processed requests requestTracker airdrop:', error.message);
        return {};
    }
};
export const updateProcessedRequest = async (telegramUserId, signature = null, amount = null, apiUpdated = false, airdrop_id = null, request_id = null) => {
    try {
        // Read the current processed requests
        let processedRequests = await redis.get('processed_requests');
        processedRequests = processedRequests ? JSON.parse(processedRequests) : {}; // Parse or initialize as empty object

        // Update the specific user's request data
        processedRequests[telegramUserId] = {
            signature,
            amount,
            apiUpdated,
            airdrop_id,
            request_id,
        };

        // Store the entire updated object back in Redis as a JSON string
        await redis.set('processed_requests', JSON.stringify(processedRequests));
        // console.log(`Updated processed request for User ID: ${telegramUserId}`);
    } catch (error) {
        console.error('Error updating processed request requestTracker airdrop:', error.message);
    }
};

const MAX_RETRIES = 3;

export const updateProcessedRequestWithRetry = async (telegramUserId, signature = null, amount = null, apiUpdated = false, airdrop_id = null, request_id = null) => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await updateProcessedRequest(telegramUserId, signature, amount, apiUpdated, airdrop_id, request_id); // Attempt to update with new values
            return; // Exit if successful
        } catch (error) {
            console.error(`Attempt ${attempt} to update processed request requestTracker airdrop for User ID: ${telegramUserId} failed: ${error.message}`);
            if (attempt === MAX_RETRIES) {
                throw new Error('Failed to update processed request after multiple attempts requestTracker airdrop');
            }
            // Add a delay before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retrying
        }
    }
};


