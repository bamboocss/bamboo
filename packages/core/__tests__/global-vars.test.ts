import { createGeneratorContext } from '@bamboocss/fixture'
import type { GlobalVarsDefinition } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

function globalVars(vars?: GlobalVarsDefinition) {
  const ctx = createGeneratorContext({
    globalVars: vars,
  })
  const sheet = ctx.createSheet()
  sheet.processGlobalCss({})
  return sheet.toCss()
}

describe('Global vars', () => {
  test('it works', () => {
    const css = globalVars({
      '--random-color': 'red',
      '--button-color': {
        syntax: '<color>',
        inherits: false,
        initialValue: 'blue',
      },
    })

    expect(css).toMatchInlineSnapshot(`
      "@layer base {
        @property --gradient-from-position {
          syntax: '*';

          inherits: false;
        }

        @property --gradient-to-position {
          syntax: '*';

          inherits: false;
        }

        @property --gradient-via-position {
          syntax: '*';

          inherits: false;
        }

        @property --blur {
          syntax: '*';

          inherits: false;
        }

        @property --brightness {
          syntax: '*';

          inherits: false;
        }

        @property --contrast {
          syntax: '*';

          inherits: false;
        }

        @property --drop-shadow {
          syntax: '*';

          inherits: false;
        }

        @property --grayscale {
          syntax: '*';

          inherits: false;
        }

        @property --hue-rotate {
          syntax: '*';

          inherits: false;
        }

        @property --invert {
          syntax: '*';

          inherits: false;
        }

        @property --saturate {
          syntax: '*';

          inherits: false;
        }

        @property --sepia {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-blur {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-brightness {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-contrast {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-grayscale {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-hue-rotate {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-invert {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-opacity {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-saturate {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-sepia {
          syntax: '*';

          inherits: false;
        }

        @property --border-spacing-x {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --border-spacing-y {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --rotate-x {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --rotate-y {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --rotate-z {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --scale-x {
          syntax: '*';

          inherits: false;

          initial-value: 1;
        }

        @property --scale-y {
          syntax: '*';

          inherits: false;

          initial-value: 1;
        }

        @property --translate-x {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --translate-y {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --translate-z {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --scroll-snap-strictness {
          syntax: '*';

          inherits: false;

          initial-value: proximity;
        }

        :where(html) {
          --random-color: red;
      }

        @property --button-color {
          syntax: '<color>';

          inherits: false;

          initial-value: blue;
        }
      }"
    `)
  })
})
