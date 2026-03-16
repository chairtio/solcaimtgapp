// commands/trading/redisUtilsTrading.js

import pTimeout from '../../utils/pTimeout.js';
import { redis } from "../../private/private.js";

const TIMEOUT_DURATION = 10000; // 10 seconds timeout for Redis operations

// Store tradingInfo information with userId as the key
export async function setTradingInfo(userId, tradingInfo) {
    try {
        await pTimeout(redis.set(`trading:${userId}`, JSON.stringify(tradingInfo)), { milliseconds: TIMEOUT_DURATION });
    } catch (error) {
        console.error('Error setting tradingInfo information in Redis:', error);
    }
}

// Get tradingInfo information for a specific user
export async function getTradingInfo(userId) {
    try {
        const tradingInfo = await pTimeout(redis.get(`trading:${userId}`), { milliseconds: TIMEOUT_DURATION });
        return tradingInfo ? JSON.parse(tradingInfo) : {}; // Default to empty object if not set
    } catch (error) {
        console.error('Error getting tradingInfo information from Redis:', error);
        return {}; // Default to empty object
    }
}


///




// Set trading position information for a specific mint address
export async function setTradingPosition(userId, mintAddress, position) {
    try {
        // Use hset to store trading position information under a hash
        const key = `position:${userId}`;
        await pTimeout(redis.hset(key, mintAddress, JSON.stringify(position)), TIMEOUT_DURATION);
    } catch (error) {
        console.error('Error setting trading position in Redis:', error);
    }
}

// Get trading position information for a specific mint address
export async function getTradingPosition(userId, mintAddress) {
    try {
        const key = `position:${userId}`;
        const position = await pTimeout(redis.hget(key, mintAddress), TIMEOUT_DURATION);
        return position ? JSON.parse(position) : null;
    } catch (error) {
        console.error('Error getting trading position from Redis:', error);
        return null;
    }
}

// Delete a specific trading position for a given mint address
export async function deleteTradingPosition(userId, mintAddress) {
    try {
        const key = `position:${userId}`;
        
        // Delete the specific field (token position) from the hash
        await pTimeout(redis.hdel(key, mintAddress), TIMEOUT_DURATION);
        // console.log(`Position for token ${mintAddress} has been deleted for user ${userId}.`);
    } catch (error) {
        console.error('Error deleting trading position in Redis:', error);
    }
}

// Update trading position for a user after a new purchase
export async function updateTradingPosition(userId, mintAddress, quantity, cost, valueSol) {
    try {
        // Retrieve the current position
        const currentPosition = await getTradingPosition(userId, mintAddress);

        // Initialize or update the position
        let updatedPosition;
        if (currentPosition) {
            // Update total quantity and cost
            updatedPosition = currentPosition;
            updatedPosition.amount_Token += quantity;
            updatedPosition.amount_Sol += cost;
            updatedPosition.value_Sol += valueSol;
        } else {
            // If no position exists, create a new one
            updatedPosition = {
                amount_Token: quantity,
                amount_Sol: cost,
                value_Sol: valueSol
            };
        }

        // Save the updated position
        await setTradingPosition(userId, mintAddress, updatedPosition);
    } catch (error) {
        console.error('Error updating trading position:', error);
    }
}


// Function to calculate the average price of a token
export async function getAveragePrice(userId, mintAddress) {
    try {
        // Retrieve the current position
        const position = await getTradingPosition(userId, mintAddress);

        if (position) {
            const { amount_Token, amount_Sol } = position;

            // Ensure amount_Token is not zero to avoid division by zero
            if (amount_Token > 0) {
                // Calculate the average price
                const averagePrice = amount_Sol / amount_Token;
                return averagePrice;
            } else {
                console.error('Total quantity is zero, cannot calculate average price.');
                return null;
            }
        } else {
            console.error('No trading position found for the given user and mint address.');
            return null;
        }
    } catch (error) {
        console.error('Error calculating average price:', error);
        return null;
    }
}


// Get up to 20 token mint addresses from Redis for a specific user
export async function getTokenMintAddresses(userId, showHidden) {
    try {
        const key = `position:${userId}`;
        const positionData = await pTimeout(redis.hgetall(key), TIMEOUT_DURATION);
        if (!positionData) return [];

        // Filter out hidden tokens if showHidden is false
        const mintAddresses = Object.keys(positionData).filter(mintAddress => {
            const tokenData = JSON.parse(positionData[mintAddress]);
            return showHidden || !tokenData.hidden; // Include if showHidden is true or token is not hidden
        });

        return mintAddresses;
    } catch (error) {
        console.error('Error getting token mint addresses from Redis:', error);
        return [];
    }
}

// Get trading positions for multiple mint addresses
export async function getTradingPositions(userId, mintAddresses) {
    try {
        const key = `position:${userId}`;
        
        // Fetch all positions for the user
        const positionData = await pTimeout(redis.hgetall(key), TIMEOUT_DURATION);
        
        if (!positionData) return {};

        // Extract trading positions for each mint address
        const tradingPositions = {};
        for (const mintAddress of mintAddresses) {
            const position = positionData[mintAddress];
            if (position) {
                tradingPositions[mintAddress] = JSON.parse(position);
            }
        }

        return tradingPositions;
    } catch (error) {
        console.error('Error getting trading positions from Redis:', error);
        return {};
    }
}
