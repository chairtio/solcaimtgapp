/**
 * Wrapper for p-timeout v6 API. Supports both:
 * - pTimeout(promise, milliseconds)
 * - pTimeout(promise, { milliseconds, message? })
 */
import pTimeoutLib from 'p-timeout'

export default function pTimeout(promise, msOrOpts, message) {
  const opts = typeof msOrOpts === 'object' && msOrOpts !== null
    ? msOrOpts
    : { milliseconds: msOrOpts, ...(message != null && { message }) }
  return pTimeoutLib(promise, opts)
}
