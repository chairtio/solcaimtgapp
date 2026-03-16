// utils/fetchWithTimeout.js
import fetch from 'node-fetch';
import pTimeout from './pTimeout.js';

export const fetchWithTimeout = async (url, options, timeout = 20000) => {
    return pTimeout(fetch(url, options), { milliseconds: timeout, message: 'Fetch request timed out' });
};
