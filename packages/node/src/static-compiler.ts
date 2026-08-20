/**
 * Whether a Bamboo source compiler is running in this JavaScript realm.
 *
 * Kept in a dependency-free entrypoint because integrations need to announce and observe the
 * flag while their configuration files are evaluated. Importing the Node package root for this
 * one bit also initializes Bamboo's config, extraction, generation, and watcher stacks before a
 * Vite hook has asked for any of them.
 *
 * A registered symbol rather than module state keeps CommonJS PostCSS configs and ESM Vite
 * configs in agreement even though Node loads a separate module instance for each format.
 */
const FLAG = Symbol.for('bamboocss.static-compiler')

/** Called synchronously by an integration that compiles source, as it is constructed. */
export const markStaticCompilerActive = () => {
  ;(globalThis as Record<symbol, unknown>)[FLAG] = true
}

export const isStaticCompilerActive = () => Boolean((globalThis as Record<symbol, unknown>)[FLAG])
