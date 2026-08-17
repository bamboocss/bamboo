import multiline from 'multiline-ts'
import rule, { RULE_NAME } from '../src/rules/no-redundant-value'
import { eslintTester } from '../test-utils'

/**
 * The shapes here come from a real production build: 304 groups of atoms that emitted byte-identical
 * declarations because the same value was spelled several ways across one codebase — one padding
 * written as `16px`, `16px 16px` and `16px 16px 0 16px`, one shadow written four ways. Each spelling
 * earns its own class and its own rule, so the sheet carries the drift.
 *
 * The rule reports rather than fixes: the shorter spelling is what the browser already computes, so
 * a suggestion is the honest severity — nothing is broken, there is just more of it than there needs
 * to be.
 */
const invalid = (code: string, output: string) => ({
  code: multiline`
    import { css } from './bamboo/css';

    const styles = css({ ${code} })`,
  errors: [
    {
      messageId: 'redundant' as const,
      suggestions: [
        {
          messageId: 'replace' as const,
          output: multiline`
            import { css } from './bamboo/css';

            const styles = css({ ${output} })`,
        },
      ],
    },
  ],
})

const valid = (code: string) => ({
  code: multiline`
    import { css } from './bamboo/css';

    const styles = css({ ${code} })`,
})

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    // Four equal edges are one value.
    invalid(`padding: '16px 16px 16px 16px'`, `padding: '16px'`),
    invalid(`padding: '16px 16px'`, `padding: '16px'`),
    // A matching pair is two.
    invalid(`margin: '0 16px 0 16px'`, `margin: '0 16px'`),
    // A matching left and right is three.
    invalid(`padding: '16px 16px 0 16px'`, `padding: '16px 16px 0'`),
    // Bamboo's own shorthand spelling of the same property.
    invalid(`p: '8px 8px'`, `p: '8px'`),
    // Not only lengths — the same collapse applies to every edge property.
    invalid(`borderWidth: '1px 1px 1px 1px'`, `borderWidth: '1px'`),
    invalid(`inset: '0 0'`, `inset: '0'`),
    // A pair property, where one value sets both.
    invalid(`gap: '8px 8px'`, `gap: '8px'`),
    // Tokens are values too, and drift the same way.
    invalid(`padding: '4 4'`, `padding: '4'`),

    /**
     * A function is one edge, not several. The split is parenthesis-aware, so the repetition is
     * still visible through a `calc()` or a `var()` — which a naive split on whitespace would both
     * miss and mangle.
     */
    invalid(`padding: 'calc(1rem + 2px) calc(1rem + 2px)'`, `padding: 'calc(1rem + 2px)'`),
    invalid(`margin: 'var(--x) var(--x)'`, `margin: 'var(--x)'`),

    /**
     * A zero length is the same zero whatever unit it carries, and the real drift this rule was
     * written from had `16px 0` and `16px 0px` as two atoms. Normalizing before the collapse is
     * what lets the second pair reach one value rather than two.
     */
    invalid(`padding: '16px 0px'`, `padding: '16px 0'`),
    invalid(`margin: '0px'`, `margin: '0'`),
    invalid(`padding: '0px 16px 0 16px'`, `padding: '0 16px'`),
    invalid(`inset: '0% 0'`, `inset: '0'`),
  ],
  valid: [
    // Already shortest.
    valid(`padding: '16px'`),
    valid(`margin: '0 16px'`),
    valid(`padding: '16px 8px 4px 2px'`),
    valid(`gap: '8px 4px'`),

    /**
     * The reason this rule carries an allowlist rather than a shape test. `background-position: 0 0`
     * is left-top; `background-position: 0` is left-centre. Same shape as `inset: 0 0`, different
     * meaning, so collapsing it would move the element.
     */
    valid(`backgroundPosition: '0 0'`),
    valid(`backgroundSize: '100% 100%'`),
    valid(`transformOrigin: '50% 50%'`),

    // Two different functions are two different edges, whatever the spaces inside them suggest.
    valid(`padding: 'calc(1rem + 2px) calc(2rem + 2px)'`),
    valid(`margin: 'var(--x) var(--y)'`),

    // An unbalanced parenthesis is not a value this parsed, so it declines rather than guessing.
    valid(`padding: 'calc(1rem + 2px 1px'`),

    // Five values is not a shape this understands, so it says nothing rather than guessing.
    valid(`padding: '1px 2px 3px 4px 5px'`),

    // Not a bamboo call.
    {
      code: multiline`
        const styles = { padding: '16px 16px' }`,
    },
  ],
})
