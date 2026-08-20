/**
 * Format-matching boundary for the independently lazy config root.
 *
 * Keep this separate from the Node adapter: CSS resolution can need config discovery without
 * constructing a Builder or loading the compiler context.
 */
export * from '@bamboocss/config'
