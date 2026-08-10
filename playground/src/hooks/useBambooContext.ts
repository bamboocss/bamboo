import { Config, StaticCssOptions, UserConfig } from '@bamboocss/types'
import { useMemo, useRef } from 'react'
import { Generator } from '@bamboocss/generator'
import { merge } from 'merge-anything'
import { resolveConfig } from '@/src/lib/config/resolve-config'
import { mergeHooks } from '@bamboocss/config/merge'
import { pluginLightningcssWasm } from '@/src/lib/lightningcss-plugin'

const defaultConfig = resolveConfig({
  cwd: '',
  include: [],
  outdir: 'styled-system',
  preflight: true,
  staticCss: { recipes: { playgroundError: ['*'] } as StaticCssOptions['recipes'] },
  jsxFramework: undefined,
})!

export const useBambooContext = (userConfig: Config | null): Generator & { error?: unknown } => {
  const previousContext = useRef<(Generator & { error?: unknown }) | null>(null)

  const getDefaultContext = () =>
    new Generator({
      dependencies: [],
      serialized: '',
      deserialize: () => defaultConfig,
      path: '',
      hooks: {},
      config: defaultConfig as UserConfig,
    })

  // userConfig reference is stable (from useState in useConfig) —
  // only changes when user edits the config tab, not on source keystrokes
  return useMemo(() => {
    let config
    let error: unknown

    try {
      config = resolveConfig({
        cwd: '',
        include: [],
        outdir: 'styled-system',
        preflight: true,
        ...userConfig,
        staticCss: merge(userConfig?.staticCss, {
          recipes: { playgroundError: ['*'] } as StaticCssOptions['recipes'],
        }),

        jsxFramework: userConfig?.jsxFramework ? 'react' : undefined,
      })
    } catch (e) {
      config = defaultConfig
      error = e
    }

    if (error) {
      // Return stable reference when there's an error to prevent cursor jumps
      const ctx = (previousContext.current ?? getDefaultContext()) as Generator & { error?: unknown }
      ctx.error = error
      return ctx
    }

    try {
      // in event of error (invalid token format), use previous generator
      let hooks = config?.hooks ?? {}

      // Swap in the WASM build when the config asks for lightningcss.
      //
      // Read off `plugins` rather than a `lightningcss: true` flag, which no longer exists —
      // the flag's only job was to push `pluginLightningcss()` into this list, and naming the
      // plugin statically is what made a native binary a dependency of every install. Matched
      // by name because the real plugin cannot run here: it binds the native module, and the
      // playground is a browser.
      const wantsLightningcss = config?.plugins?.some((plugin) => plugin?.name?.includes('lightningcss'))

      if (wantsLightningcss) {
        const plugin = pluginLightningcssWasm()
        hooks = mergeHooks([plugin, { name: '__resolved__', hooks }])
      }

      const context = new Generator({
        dependencies: [],
        serialized: '',
        deserialize: () => config!,
        path: '',
        hooks,
        config: config as any,
      })
      previousContext.current = context
      return context
    } catch {
      if (previousContext.current) {
        return previousContext.current!
      }

      // or use default config cause we always need a context
      previousContext.current = getDefaultContext()

      return getDefaultContext()
    }
  }, [userConfig])
}
