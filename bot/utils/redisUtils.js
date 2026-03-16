import { redis } from "../private/private.js";
import pTimeout from './pTimeout.js';

// Helper functions for Redis operations
export const saveMessageId = async (userId, messageId, type) => {
    try {
        await pTimeout(redis.set(`messageIdStore:${userId}:${type}`, messageId), { milliseconds: 10000 }); // 10 seconds timeout
    } catch (error) {
        console.error('Failed to save message ID:', error.message);
    }
};

export const getMessageId = async (userId, type) => {
    try {
        return await pTimeout(redis.get(`messageIdStore:${userId}:${type}`), { milliseconds: 10000 }); // 10 seconds timeout
    } catch (error) {
        console.error('Failed to get message ID:', error.message);
        return null;
    }
};

export const deleteMessageId = async (userId, type) => {
    try {
        await pTimeout(redis.del(`messageIdStore:${userId}:${type}`), { milliseconds: 10000 }); // 10 seconds timeout
    } catch (error) {
        console.error('Failed to delete message ID:', error.message);
    }
};

// mint address
export const setMintAddressStr = async (userId, mintAddressStr) => {
    try {
        await pTimeout(redis.set(`mintAddressStr:${userId}`, mintAddressStr), { milliseconds: 10000 }); // 10 seconds timeout
    } catch (error) {
        console.error('Failed to save mint address string:', error.message);
    }
};

export const getMintAddressStr = async (userId) => {
    try {
        return await pTimeout(redis.get(`mintAddressStr:${userId}`), { milliseconds: 10000 }); // 10 seconds timeout
    } catch (error) {
        console.error('Failed to get mint address string:', error.message);
        return null;
    }
};

export const deleteMintAddressStr = async (userId) => {
    try {
        await pTimeout(redis.del(`mintAddressStr:${userId}`), { milliseconds: 10000 }); // 10 seconds timeout
    } catch (error) {
        console.error('Failed to delete mint address string:', error.message);
    }
};
