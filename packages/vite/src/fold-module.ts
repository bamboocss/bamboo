/**
 * The complete static-fold runtime boundary.
 *
 * Keeping these factories beside the fold prevents Rolldown from extracting their shared
 * implementation into a chunk imported by the public entry. Nothing in this module is needed
 * until a transform actually attempts to compile source.
 */
export { foldSource, verifyExportReads } from './fold'
export { createRuntimeCss } from './runtime-css'
export { createStaticStyleSetCompiler } from './style-set'
