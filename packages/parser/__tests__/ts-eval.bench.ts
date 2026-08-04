import { bench, describe } from 'vitest'
import { parseAndExtract } from './fixture'

describe('ts-eval', () => {
  bench(
    'with ts-eval',
    () => {
      const code = `
    const variants = () => {
        const spacingTokens = Object.entries({
            s: 'token(spacing.1)',
            m: 'token(spacing.2)',
            l: 'token(spacing.3)',
        });

        const spacingProps = {
            'px': 'paddingX',
            'py': 'paddingY',
        };

        // Generate variants programmatically
        return Object.entries(spacingProps)
            .map(([name, styleProp]) => {
                const variants = spacingTokens
                    .map(([variant, token]) => ({ [variant]: { [styleProp]: token } }))
                    .reduce((_agg, kv) => ({ ..._agg, ...kv }));

                return { [name]: variants };
            })
            .reduce((_agg, kv) => ({ ..._agg, ...kv }));
      }
      const baseStyle = cva({
          variants: variants(),
      })
      `

      parseAndExtract(code)
    },
    // Warm explicitly: the first parse in a process pays ts-morph's lazy init, which
    // is large enough next to a ~5ms parse to drift the mean between runs.
    { warmupIterations: 20, iterations: 50 },
  )

  bench(
    'without ts-eval',
    () => {
      const code = `const variants = () => {
            return {"px":{"s":{"paddingX":"token(spacing.1)"},"m":{"paddingX":"token(spacing.2)"},"l":{"paddingX":"token(spacing.3)"}},"py":{"s":{"paddingY":"token(spacing.1)"},"m":{"paddingY":"token(spacing.2)"},"l":{"paddingY":"token(spacing.3)"}}}
          }
          const baseStyle = cva({
              variants: variants(),
          })`

      parseAndExtract(code)
    },
    { warmupIterations: 20, iterations: 50 },
  )
})
