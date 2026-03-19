/**
 * Server-only database module.
 *
 * This file exists to prevent accidental imports of the service-role backed
 * database layer from client components.
 */
export * from './database'

