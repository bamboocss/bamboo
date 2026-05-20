import { logger } from '@bamboocss/logger'
import type { AnyFunction, BambooHooks, BambooPlugin } from '@bamboocss/types'

type HookEntry = [pluginName: string, cb: AnyFunction]

export const mergeHooks = (plugins: BambooPlugin[]) => {
  const hooksFns: Partial<Record<keyof BambooHooks, HookEntry[]>> = {}

  plugins.forEach(({ name, hooks }) => {
    Object.entries(hooks ?? {}).forEach(([key, value]) => {
      if (!hooksFns[key as keyof BambooHooks]) {
        hooksFns[key as keyof BambooHooks] = [] as HookEntry[]
      }

      hooksFns[key as keyof BambooHooks]!.push([name, value])
    })
  })

  const mergedHooks = Object.fromEntries(
    Object.entries(hooksFns).map(([key, entries]) => {
      const fns = entries.map(([name, fn]) => tryCatch(name, fn))

      // Those special hooks use their callback return to update the internal state
      // Each fn is called sequentially and the result of the previous hook is passed to the next hook
      const reducer = key in reducers ? reducers[key as keyof typeof reducers] : undefined
      if (reducer) {
        return [key, reducer(fns)]
      }

      return [key, syncHooks.includes(key as keyof BambooHooks) ? callAll(...fns) : callAllAsync(...fns)]
    }),
  ) as Partial<BambooHooks>

  return mergedHooks
}

type Reducer<T extends keyof BambooHooks> = (fns: Array<BambooHooks[T]>) => BambooHooks[T]

const createReducer = <T extends keyof BambooHooks>(reducer: Reducer<T>) => reducer

const reducers = {
  'config:resolved': createReducer<'config:resolved'>((fns) => async (_args) => {
    // this allows mutating the args object to pass information to the next hook
    // without mutating the original args object
    const args = Object.assign({}, _args)
    const original = _args.config
    let config = args.config

    for (const hookFn of fns) {
      const result = await hookFn(Object.assign(args, { config, original }))
      if (result !== undefined) {
        config = result
      }
    }

    return config
  }),
  'parser:before': createReducer<'parser:before'>((fns) => (_args) => {
    const args = Object.assign({}, _args)
    const original = _args.content
    let content = args.content

    for (const hookFn of fns) {
      const result = hookFn(Object.assign(args, { content, original }))
      if (result !== undefined) {
        content = result
      }
    }

    return content
  }),
  'parser:preprocess': createReducer<'parser:preprocess'>((fns) => (_args) => {
    const args = Object.assign({}, _args)
    const original = _args.data
    let data = args.data

    for (const hookFn of fns) {
      const result = hookFn(Object.assign(args, { data, original }))
      if (result !== undefined) {
        data = result
      }
    }

    return data
  }),
  'cssgen:done': createReducer<'cssgen:done'>((fns) => (_args) => {
    const args = Object.assign({}, _args)
    const original = _args.content
    let content = args.content

    for (const hookFn of fns) {
      const result = hookFn(Object.assign(args, { content, original }))
      if (result !== undefined) {
        content = result
      }
    }
    return content
  }),
  'codegen:prepare': createReducer<'codegen:prepare'>((fns): BambooHooks['codegen:prepare'] => async (_args) => {
    const args = Object.assign({}, _args)
    const original = _args.artifacts
    let artifacts = args.artifacts

    for (const hookFn of fns) {
      const result = await hookFn(Object.assign(args, { artifacts, original }))

      // it's fine to not return anything, it will just be ignored
      if (result) {
        artifacts = result
      }
    }

    return artifacts
  }),
  'preset:resolved': createReducer<'preset:resolved'>((fns) => async (_args) => {
    const args = Object.assign({}, _args)
    const original = _args.preset
    let preset = args.preset

    for (const hookFn of fns) {
      const result = await hookFn(Object.assign(args, { preset, original }))
      if (result !== undefined) {
        preset = result
      }
    }

    return preset
  }),
  'css:optimize': createReducer<'css:optimize'>((fns) => (_args) => {
    const args = Object.assign({}, _args)
    const original = _args.css
    let css = args.css

    for (const hookFn of fns) {
      const result = hookFn(Object.assign(args, { css, original }))
      if (result !== undefined) {
        css = result
      }
    }

    return css
  }),
}

const syncHooks: Array<keyof BambooHooks> = [
  'context:created',
  'parser:before',
  'parser:preprocess',
  'parser:after',
  'cssgen:done',
  'css:optimize',
]

const callAllAsync =
  <T extends (...a: any[]) => void | Promise<void>>(...fns: (T | undefined)[]) =>
  async (...a: Parameters<T>) => {
    for (const fn of fns) {
      await fn?.(...a)
    }
  }

const callAll =
  <T extends (...a: any[]) => void | Promise<void>>(...fns: (T | undefined)[]) =>
  (...a: Parameters<T>) => {
    fns.forEach((fn) => fn?.(...a))
  }

const tryCatch = (name: string, fn: AnyFunction) => {
  return (...args: any[]) => {
    try {
      return fn(...args)
    } catch (e) {
      logger.caughtError('hooks', `Error in plugin "${name}"`, e)
    }
  }
}
