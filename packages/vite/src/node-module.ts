/**
 * Format-matching boundary for the lazy Node root.
 *
 * The public entry dynamically imports this internal module, so the CommonJS build reaches it
 * with `require` and the ESM build reaches it with `import`. Its static re-export then selects
 * the same condition from `@bamboocss/node` instead of preserving an external native import in
 * the CommonJS entry.
 */
export * from '@bamboocss/node'
