type NodeModule = typeof import('@bamboocss/node')
type ConfigModule = typeof import('@bamboocss/config')
type CssOutputModule = typeof import('./css-output-module')
type FoldModule = typeof import('./fold-module')

/**
 * Keep one asynchronous initialization in flight, retain its fulfilled value, and forget only
 * a rejected attempt so a later Vite rebuild can recover.
 *
 * Starting through a resolved promise also turns a synchronous loader throw into the same
 * rejected-promise contract as a failed dynamic import.
 */
export const createRetryableLazy = <Value>(load: () => Value | PromiseLike<Value>) => {
  let pending: Promise<Value> | undefined

  return () => {
    if (pending) return pending

    const attempt = Promise.resolve().then(load)
    pending = attempt
    void attempt.catch(() => {
      if (pending === attempt) pending = undefined
    })
    return attempt
  }
}

/** Process-wide module loading; individual plugin instances still own their mutable state. */
export const loadNodeModule = createRetryableLazy<NodeModule>(() => import('./node-module'))
export const loadConfigModule = createRetryableLazy<ConfigModule>(() => import('./config-module'))

/**
 * Keep stylesheet parsing, selector inventory and late sourcemap rewriting behind one built
 * chunk. The injectable loader proves sharing and retry without exposing a package subpath.
 */
export const createLazyCssOutputModule = (
  loadCssOutput: () => CssOutputModule | PromiseLike<CssOutputModule> = () => import('./css-output-module'),
) => createRetryableLazy(loadCssOutput)

/** One process-wide CSS-output load shared by every plugin instance and Vite environment. */
export const loadCssOutputModule = createLazyCssOutputModule()

/**
 * Keep the AST fold behind its own built chunk. The injectable loader is an architectural
 * seam: callers can prove sharing and retry without a production-only switch, while the
 * default remains a statically discoverable dynamic import for both published formats.
 */
export const createLazyFoldModule = (
  loadFold: () => FoldModule | PromiseLike<FoldModule> = () => import('./fold-module'),
) => createRetryableLazy(loadFold)

/** One process-wide fold-module load shared by every plugin instance and Vite environment. */
export const loadFoldModule = createLazyFoldModule()

/** One Builder per CSS plugin instance, created only when a hook first needs it. */
export const createLazyBuilder = (loadNode: () => Promise<Pick<NodeModule, 'Builder'>> = loadNodeModule) =>
  createRetryableLazy(async () => {
    const { Builder } = await loadNode()
    return new Builder()
  })

/** Build and publish one complete fold state; no caller can observe partial initialization. */
export const createLazyCompilerState = <Context, RuntimeCss, StyleCompiler, FoldSource, VerifyReads>(
  loadContext: () => Promise<Context>,
  loadFold: () => PromiseLike<{
    foldSource: FoldSource
    verifyExportReads?: VerifyReads
    createRuntimeCss: (context: NoInfer<Context>) => RuntimeCss
    createStaticStyleSetCompiler: (context: NoInfer<Context>, runtimeCss: RuntimeCss) => StyleCompiler
  }>,
) =>
  createRetryableLazy(async () => {
    // Load both independent halves together. A fulfilled context can be retained by its own
    // loader when the chunk fails, but no derived compiler value is published from this attempt.
    const [context, fold] = await Promise.all([loadContext(), loadFold()])
    const runtimeCss = fold.createRuntimeCss(context)
    const styleCompiler = fold.createStaticStyleSetCompiler(context, runtimeCss)
    return {
      context,
      foldSource: fold.foldSource,
      verifyExportReads: fold.verifyExportReads,
      runtimeCss,
      styleCompiler,
    }
  })
