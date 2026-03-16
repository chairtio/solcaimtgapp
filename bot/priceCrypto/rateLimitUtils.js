import { redis } from '../private/private.js';

const rateLimits = {
  kucoin: { limit: 3000, interval: 60 * 1000 }, // 50 requests per second
  okx: { limit: 1200, interval: 60 * 1000 }, // 20 requests per second
  huobi: { limit: 3000, interval: 60 * 1000 }, // 50 requests per second
  gate: { limit: 300, interval: 60 * 1000 }, // 5 requests per second
  bitget: { limit: 600, interval: 60 * 1000 }, // 10 requests per second
  mexc: { limit: 600, interval: 60 * 1000 }, // 10 requests per second
};

function getLimit(exchangeName) {
  return rateLimits[exchangeName]?.limit || 0; // Default to 0 if not found
}

export async function rateLimiter(exchangeName) {
    const limit = getLimit(exchangeName);
    const key = `rate-limit:${exchangeName}`;
  
    try {
      const current = await redis.incr(key);
      const interval = rateLimits[exchangeName]?.interval / 1000; // Get interval in seconds
  
      if (current === 1) {
        await redis.expire(key, interval);
      }
  
      if (current > limit) {
        return false; // Rate limit exceeded
      }
      return true; // Allow the request
    } catch (error) {
      console.error(`Error in rateLimiter for ${exchangeName}: ${error.message}`);
      return true; // If an error occurs, we can still allow the request as a fallback
    }
}
  
