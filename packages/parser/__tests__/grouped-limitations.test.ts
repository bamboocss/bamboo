import { createCss, createMergeCss, groupClassName } from '@bamboocss/shared'
import { createContext } from '@bamboocss/fixture'
import { describe, test, expect } from 'vitest'
import { parseAndExtract } from './fixture'

function createRuntimeCss() {
  const ctx = createContext()
  return createCss({
    grouped: true,
    conditions: {
      shift: ctx.conditions.shift,
      finalize: ctx.conditions.finalize,
      breakpoints: { keys: ctx.conditions.breakpoints.keys },
    },
    utility: {
      prefix: ctx.utility.prefix,
      hasShorthand: ctx.utility.hasShorthand,
      resolveShorthand: ctx.utility.resolveShorthand.bind(ctx.utility),
      transform: ctx.utility.transform.bind(ctx.utility),
      toHash: ctx.utility.toHash.bind(ctx.utility),
    },
  })
}

/**
 * The browser's `css()`, wired to the registry this build would have written.
 *
 * `createRuntimeCss` above answers "which class does the runtime name", which is enough to
 * show a hash diverging. This one answers the question that decides whether the user sees
 * anything: given the registry, what does the element actually carry, and is any of it
 * backed by a rule? Without `knownGroups` the fallback never runs and every case below
 * would look identical.
 */
function createRuntime(result: ReturnType<typeof parseAndExtract>) {
  const ctx = result.ctx
  const knownGroups = new Set<string>()
  result.encoder.grouped.forEach((_hashes, groupId) => {
    knownGroups.add(groupClassName(groupId, ctx.utility.toHash, ctx.utility.formatClassName))
  })

  const context = {
    grouped: true,
    knownGroups,
    conditions: {
      shift: ctx.conditions.shift,
      finalize: ctx.conditions.finalize,
      breakpoints: { keys: ctx.conditions.breakpoints.keys },
    },
    utility: {
      prefix: ctx.utility.prefix,
      hasShorthand: ctx.utility.hasShorthand,
      resolveShorthand: ctx.utility.resolveShorthand.bind(ctx.utility),
      transform: ctx.utility.transform.bind(ctx.utility),
      toHash: ctx.utility.toHash.bind(ctx.utility),
    },
  }

  const cssFn = createCss(context)
  const { mergeCss } = createMergeCss(context)
  return (...styles: Record<string, any>[]) =>
    cssFn(mergeCss(...styles))
      .split(' ')
      .filter(Boolean)
}

/** Class attributes are unescaped; the selectors they have to match are not. */
const backed = (css: string, classNames: string[]) =>
  classNames.filter((className) => css.includes('.' + className.replace(/([.:!])/g, '\\$1')))

describe('cssMode: grouped — known limitations', () => {
  test('unresolvable value: build only sees partial styles, runtime hash diverges', () => {
    const code = `
    import { css } from "styled-system/css"

    function App(props: { color: string }) {
      return <div className={css({ fontSize: "xl", color: props.color })} />
    }
    `
    const result = parseAndExtract(code, { cssMode: 'grouped' })

    // Build only extracts { fontSize: "xl" } — drops unresolvable props.color
    expect(result.json[0].data).toEqual([{ fontSize: 'xl' }])
    expect(result.encoder.grouped.size).toBe(1)
    expect(result.css).toContain('font-size')
    expect(result.css).not.toContain('color')

    // Runtime sees the full object and computes a different hash
    const cssFn = createRuntimeCss()
    const runtimeClass = cssFn({ fontSize: 'xl', color: 'red' })

    // The build-generated CSS has no rule for the runtime's class
    expect(result.css).not.toContain(runtimeClass)
  })

  test('ternary: parser reconstructs combined groups from branches + base', () => {
    const code = `
    import { css } from "styled-system/css"
    import { useState } from "react"

    function App() {
      const [active, setActive] = useState(false)
      return <div className={css({ fontSize: "xl", color: active ? "red" : "blue" })} />
    }
    `
    const result = parseAndExtract(code, { cssMode: 'grouped' })

    // Parser produces 3 data entries, but reconstructs 2 combined groups
    expect(result.json[0].data).toEqual([{ color: 'red' }, { color: 'blue' }, { fontSize: 'xl' }])
    expect(result.encoder.grouped.size).toBe(2)

    // Runtime evaluates the ternary and sees { fontSize: "xl", color: "red" } as one object
    const cssFn = createRuntimeCss()
    const runtimeClassRed = cssFn({ fontSize: 'xl', color: 'red' })
    const runtimeClassBlue = cssFn({ fontSize: 'xl', color: 'blue' })

    // Build-generated CSS contains rules for both branches
    expect(result.css).toContain(runtimeClassRed)
    expect(result.css).toContain(runtimeClassBlue)
  })

  test('css.raw merging: build merges non-overlapping entries into one group', () => {
    const code = `
    import { css } from "styled-system/css"

    const base = css.raw({ fontSize: "xl" })
    const extra = css.raw({ color: "red" })

    function App() {
      return <div className={css(base, extra)} />
    }
    `
    const result = parseAndExtract(code, { cssMode: 'grouped' })

    expect(result.css).toContain('font-size')
    expect(result.css).toContain('color')

    // Runtime merges the raw objects and hashes the combined result
    const cssFn = createRuntimeCss()
    const runtimeClass = cssFn({ fontSize: 'xl', color: 'red' })

    // Build-generated CSS matches the merged hash
    expect(result.css).toContain(runtimeClass)
  })

  // --- Cases that DO work ---

  test('fully static css() works correctly', () => {
    const code = `
    import { css } from "styled-system/css"

    css({ fontSize: "xl", color: "red" })
    `
    const result = parseAndExtract(code, { cssMode: 'grouped' })

    expect(result.encoder.grouped.size).toBe(1)

    const cssFn = createRuntimeCss()
    const runtimeClass = cssFn({ fontSize: 'xl', color: 'red' })

    // Build and runtime agree
    expect(result.css).toContain(runtimeClass)
  })

  test('spread from statically resolvable const works correctly', () => {
    const code = `
    import { css } from "styled-system/css"

    const base = { fontSize: "xl" }

    function App() {
      return <div className={css({ ...base, color: "red" })} />
    }
    `
    const result = parseAndExtract(code, { cssMode: 'grouped' })

    expect(result.encoder.grouped.size).toBe(1)

    const cssFn = createRuntimeCss()
    const runtimeClass = cssFn({ fontSize: 'xl', color: 'red' })

    // Build and runtime agree
    expect(result.css).toContain(runtimeClass)
  })
})

/** Every declaration the runtime asks for has *some* class carrying it. */
const expectNothingLost = (
  result: ReturnType<typeof parseAndExtract>,
  classNames: string[],
  declarations: string[],
) => {
  expect(backed(result.css, classNames).length, `nothing backed in "${classNames.join(' ')}"`).toBeGreaterThan(0)
  for (const declaration of declarations) {
    expect(result.css, `no rule declares ${declaration}`).toContain(declaration)
  }
}

/**
 * `css()` groups; everything else degrades to atomic.
 *
 * Only `setCss` reconstructs the call the runtime will make — a ternary's branches merged
 * with the properties beside them. A JSX element or a pattern encodes each extracted entry
 * on its own, so as soon as there is more than one the group the runtime asks for was never
 * emitted, and the same is true of a call carrying a value the build could not evaluate.
 *
 * What those cases must not do is render the element with nothing. The build emits their
 * atomic rules alongside the group, so the runtime's fallback lands on a stylesheet that
 * carries every declaration it names — which is what `cssMode: 'atomic'` would have given.
 */
describe('cssMode: grouped — what degrades to atomic', () => {
  test('a conditional value beside another prop on a JSX element keeps both', () => {
    const result = parseAndExtract(
      `import { styled } from "styled-system/jsx"
       export const A = ({ on }) => <styled.div color={on ? "red" : "blue"} padding="2" />`,
      { cssMode: 'grouped' },
    )

    // The group covering both properties is not emitted — `setJsx` does not recombine the
    // entries — so the runtime falls back, and the fallback has rules to land on.
    const classNames = createRuntime(result)({ color: 'red', padding: '2' })
    expect(classNames.length).toBeGreaterThan(1)
    expectNothingLost(result, classNames, ['color: red', 'padding'])
  })

  test('a conditional value on its own still groups, with no atomic duplication', () => {
    const result = parseAndExtract(
      `import { styled } from "styled-system/jsx"
       export const A = ({ on }) => <styled.div color={on ? "red" : "blue"} />`,
      { cssMode: 'grouped' },
    )

    // Each branch is a complete object, so each is a complete group.
    for (const color of ['red', 'blue']) {
      const classNames = createRuntime(result)({ color })
      expect(classNames).toHaveLength(1)
      expect(backed(result.css, classNames)).toEqual(classNames)
    }
  })

  test('a fully static JSX element still groups, with no atomic duplication', () => {
    const result = parseAndExtract(
      `import { styled } from "styled-system/jsx"
       export const A = () => <styled.div color="red" padding="2" />`,
      { cssMode: 'grouped' },
    )

    expect(result.encoder.atomic.size).toBe(0)
    const classNames = createRuntime(result)({ color: 'red', padding: '2' })
    expect(classNames).toHaveLength(1)
    expect(backed(result.css, classNames)).toEqual(classNames)
  })

  test('a pattern with a conditional value beside another prop keeps both', () => {
    const result = parseAndExtract(
      `import { stack } from "styled-system/patterns"
       export const A = ({ on }) => <div className={stack({ gap: on ? "2" : "4", padding: "2" })} />`,
      { cssMode: 'grouped' },
    )

    const classNames = createRuntime(result)({
      gap: '2',
      padding: '2',
      display: 'flex',
      flexDirection: 'column',
    })
    expectNothingLost(result, classNames, ['gap', 'padding', 'display: flex'])
  })

  test('a static pattern still groups, with no atomic duplication', () => {
    const result = parseAndExtract(
      `import { stack } from "styled-system/patterns"
       export const A = () => <div className={stack({ gap: "2" })} />`,
      { cssMode: 'grouped' },
    )

    expect(result.encoder.atomic.size).toBe(0)
    const classNames = createRuntime(result)({ gap: '2', display: 'flex', flexDirection: 'column' })
    expect(classNames).toHaveLength(1)
    expect(backed(result.css, classNames)).toEqual(classNames)
  })

  test('an unresolvable value beside another prop on a JSX element keeps the resolved one', () => {
    const result = parseAndExtract(
      `import { styled } from "styled-system/jsx"
       export const A = (props) => <styled.div color={props.tone} padding="2" />`,
      { cssMode: 'grouped' },
    )

    // `color` has no rule under any mode — the build never saw the value. `padding` does.
    const classNames = createRuntime(result)({ color: 'tomato', padding: '2' })
    expectNothingLost(result, classNames, ['padding'])
  })
})

/**
 * `css()` itself, where the group has to be exact.
 *
 * These are the calls whose combinations `setCss` reconstructs. Where it can name the call
 * the runtime will make, it must — a degraded `css()` call is a correctness win but a
 * grouping loss, and grouping is the whole point of the mode.
 */
describe('cssMode: grouped — what css() groups', () => {
  test('a ternary inside a condition block beside another property', () => {
    const result = parseAndExtract(
      `import { css } from "styled-system/css"
       export const A = ({ on }) => <div className={css({ _hover: { color: on ? "red" : "blue" }, padding: "2" })} />`,
      { cssMode: 'grouped' },
    )

    // The branch entries carry `_hover`, and so does the entry carrying `padding` — as an
    // empty object. Combining them shallowly replaced the branch's condition with that
    // empty one; merging them the way `mergeCss` does keeps both.
    for (const color of ['red', 'blue']) {
      const classNames = createRuntime(result)({ _hover: { color }, padding: '2' })
      expect(classNames).toHaveLength(1)
      expect(backed(result.css, classNames)).toEqual(classNames)
    }
  })

  test('an array argument is merged, not read as a responsive array', () => {
    const result = parseAndExtract(
      `import { css } from "styled-system/css"
       export const A = () => <div className={css([{ color: "red" }, { padding: "2" }])} />`,
      { cssMode: 'grouped' },
    )

    // `mergeCss` flattens the array and merges its members into one object. Hashing the
    // array itself read index 1 as the `sm` breakpoint.
    const classNames = createRuntime(result)([{ color: 'red' }, { padding: '2' }] as never)
    expect(classNames).toHaveLength(1)
    expect(backed(result.css, classNames)).toEqual(classNames)
    expect(result.css).not.toContain('min-width')
  })

  test('a property lost to a spread degrades, and says so', () => {
    const result = parseAndExtract(
      `import { css } from "styled-system/css"
       export const A = (props) => <div className={css({ ...props.styles, color: "red" })} />`,
      { cssMode: 'grouped' },
    )

    // The spread's keys cannot be enumerated, so the group is a guess. What the build can
    // see is that the spread contributed nothing at all, which makes the guess a bad one.
    expect(result.parserResult.unresolved.map((entry) => entry.reason)).toContain('unenumerable-keys')
    const classNames = createRuntime(result)({ padding: '2', color: 'red' })
    expectNothingLost(result, classNames, ['color: red'])
  })

  test('two operands whose shared key holds a condition object degrade, and say so', () => {
    const result = parseAndExtract(
      `import { css } from "styled-system/css"
       export const A = () => <div className={css({ color: { base: "red" } }, { color: { _hover: "blue" } })} />`,
      { cssMode: 'grouped' },
    )

    // A shared key across two arguments is a merge, not a pair of alternatives — but the
    // extracted entries look the same either way, so the call is treated as at-risk.
    expect(result.parserResult.unresolved).not.toEqual([])
    const classNames = createRuntime(result)({ color: { base: 'red' } }, { color: { _hover: 'blue' } })
    expectNothingLost(result, classNames, ['color: red', 'color: blue'])
  })

  test('two operands with disjoint keys still group into one class', () => {
    const result = parseAndExtract(
      `import { css } from "styled-system/css"
       export const A = () => <div className={css({ color: "red" }, { padding: "2" })} />`,
      { cssMode: 'grouped' },
    )

    expect(result.parserResult.unresolved).toEqual([])
    const classNames = createRuntime(result)({ color: 'red' }, { padding: '2' })
    expect(classNames).toHaveLength(1)
    expect(backed(result.css, classNames)).toEqual(classNames)
  })
})
