import type { ExportDeclaration, ImportDeclaration } from 'ts-morph'

/**
 * Both declaration kinds carry a specifier, and `export { x } from './m'` is how a barrel
 * forwards a recipe — so this reads either. An `export { x }` with no `from` returns
 * undefined, which is the same answer the throwing case gives.
 */
export const getModuleSpecifierValue = (node: ExportDeclaration | ImportDeclaration) => {
  try {
    return node.getModuleSpecifierValue()
  } catch {
    return
  }
}
