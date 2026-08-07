import type { PropertyValues, UtilityConfig } from '@bamboocss/types'
import { createColorMixTransform } from '../color-mix-transform'

const gradientVia = createColorMixTransform('--gradient-via')

const linearGradientDirectionMap = new Map([
  ['to-t', 'to top'],
  ['to-tr', 'to top right'],
  ['to-r', 'to right'],
  ['to-br', 'to bottom right'],
  ['to-b', 'to bottom'],
  ['to-bl', 'to bottom left'],
  ['to-l', 'to left'],
  ['to-tl', 'to top left'],
])

const isGradientShortcut = (value: string) => linearGradientDirectionMap.has(value)

const linearGradientValues: PropertyValues = (theme) => {
  return {
    ...theme('gradients'),
    ...Object.fromEntries(linearGradientDirectionMap.entries()),
  }
}

/**
 * The position vars carry an empty fallback because a colour stop's position is optional:
 * `red 20%` and `red` are both valid, and the unset case has to compose to the second.
 *
 * They are registered with no `initial-value` (see `globalVars`), which gives them the
 * guaranteed-invalid value — so a reference without a fallback would take the whole
 * `--gradient-stops` declaration invalid at computed-value time and drop the gradient
 * entirely. Writing the fallback here keeps that decision next to the composition that
 * depends on it, rather than resting on a default declared in another package.
 */
const gradientStops =
  'var(--gradient-via-stops, var(--gradient-position), var(--gradient-from) var(--gradient-from-position, ), var(--gradient-to) var(--gradient-to-position, ))'

const gradientViaStops =
  'var(--gradient-position), var(--gradient-from) var(--gradient-from-position, ), var(--gradient-via) var(--gradient-via-position, ), var(--gradient-to) var(--gradient-to-position, )'

export const backgroundGradients: UtilityConfig = {
  backgroundGradient: {
    shorthand: 'bgGradient',
    className: 'bg-grad',
    group: 'Background Gradient',
    values: linearGradientValues,
    transform(value, { raw, token }) {
      const tokenValue = token(`gradients.${raw}`)
      if (tokenValue) {
        return { backgroundImage: tokenValue }
      }

      // If not a known direction shortcut, use the value as-is (with token refs expanded)
      if (!isGradientShortcut(raw)) {
        return { backgroundImage: value }
      }

      return {
        '--gradient-stops': gradientStops,
        '--gradient-position': linearGradientDirectionMap.get(raw),
        backgroundImage: `linear-gradient(var(--gradient-stops))`,
      }
    },
    // Declared here rather than on each of the five utilities that compose a gradient, the
    // same way the position vars are declared by the one that writes them. Every one of the
    // five writes both in the rule that reads them, so registering changes nothing except
    // that they stop inheriting into a descendant that sets a gradient of its own.
    customProperties: {
      '--gradient-stops': { inherits: false, syntax: '*' },
      '--gradient-position': { inherits: false, syntax: '*' },
    },
  },

  backgroundLinear: {
    shorthand: 'bgLinear',
    className: 'bg-linear',
    group: 'Background Gradient',
    values: linearGradientValues,
    transform(value, { raw, token }) {
      const tokenValue = token(`gradients.${raw}`)
      if (tokenValue) {
        return { backgroundImage: tokenValue }
      }

      // If not a known direction shortcut, use the value as-is (with token refs expanded)
      if (!isGradientShortcut(raw)) {
        return { backgroundImage: value }
      }

      return {
        '--gradient-stops': gradientStops,
        '--gradient-position': linearGradientDirectionMap.get(raw),
        backgroundImage: `linear-gradient(var(--gradient-stops))`,
      }
    },
  },

  backgroundRadial: {
    shorthand: 'bgRadial',
    className: 'bg-radial',
    group: 'Background Gradient',
    values: 'gradients',
    transform(value, { raw, token }) {
      const tokenValue = token(`gradients.${raw}`)
      if (tokenValue) {
        return { backgroundImage: tokenValue }
      }

      return {
        '--gradient-stops': gradientStops,
        '--gradient-position': value,
        backgroundImage: `radial-gradient(var(--gradient-stops,${value}))`,
      }
    },
  },

  backgroundConic: {
    shorthand: 'bgConic',
    className: 'bg-conic',
    group: 'Background Gradient',
    transform(value) {
      return {
        '--gradient-stops': gradientStops,
        '--gradient-position': value,
        backgroundImage: `conic-gradient(var(--gradient-stops))`,
      }
    },
  },

  textGradient: {
    className: 'txt-grad',
    group: 'Background Gradient',
    values: linearGradientValues,
    transform(value, { raw, token }) {
      const tokenValue = token(`gradients.${raw}`)
      if (tokenValue) {
        return {
          backgroundImage: tokenValue,
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }
      }
      // If not a known direction shortcut, use the value as-is (with token refs expanded)
      if (!isGradientShortcut(raw)) {
        return {
          backgroundImage: value,
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }
      }
      return {
        '--gradient-stops': gradientStops,
        '--gradient-position': linearGradientDirectionMap.get(raw),
        backgroundImage: `linear-gradient(var(--gradient-stops))`,
        WebkitBackgroundClip: 'text',
        color: 'transparent',
      }
    },
  },
  gradientFromPosition: {
    className: 'grad-from-pos',
    group: 'Background Gradient',
    transform(value) {
      return {
        '--gradient-from-position': value,
      }
    },
    // Declared by the utility that writes it rather than by each of the five that compose a
    // gradient from it. No `initialValue`: a stop's position is optional, and the reads in
    // `gradientStops` carry the empty fallback that makes an unset one compose to nothing.
    customProperties: {
      '--gradient-from-position': { inherits: false, syntax: '*' },
    },
  },
  gradientToPosition: {
    className: 'grad-to-pos',
    group: 'Background Gradient',
    transform(value) {
      return {
        '--gradient-to-position': value,
      }
    },
    customProperties: {
      '--gradient-to-position': { inherits: false, syntax: '*' },
    },
  },
  gradientFrom: {
    className: 'grad-from',
    values: 'colors',
    group: 'Background Gradient',
    transform: createColorMixTransform('--gradient-from'),
    // Unlike the position vars above, the colour is read *bare* — `var(--gradient-from)`
    // with no fallback — so an unset one has to stay guaranteed-invalid, which is what
    // registering without an `initialValue` gives. That invalidates `--gradient-stops` at
    // computed-value time and drops the gradient, rather than rendering half of one.
    //
    // Registered so it stops inheriting: a child setting only `bgGradient` used to compose
    // its gradient from whatever colours an ancestor happened to declare.
    customProperties: {
      '--gradient-from': { inherits: false, syntax: '*' },
    },
  },
  gradientTo: {
    className: 'grad-to',
    values: 'colors',
    group: 'Background Gradient',
    transform: createColorMixTransform('--gradient-to'),
    customProperties: {
      '--gradient-to': { inherits: false, syntax: '*' },
    },
  },
  gradientVia: {
    className: 'grad-via',
    values: 'colors',
    group: 'Background Gradient',
    transform(value, args) {
      const transformed = gradientVia(value, args)
      return {
        ...transformed,
        '--gradient-stops': 'var(--gradient-via-stops)',
        '--gradient-via-stops': gradientViaStops,
      }
    },
    customProperties: {
      '--gradient-via': { inherits: false, syntax: '*' },
      '--gradient-via-stops': { inherits: false, syntax: '*' },
    },
  },
  gradientViaPosition: {
    className: 'grad-via-pos',
    group: 'Background Gradient',
    transform(value) {
      return {
        '--gradient-via-position': value,
      }
    },
    customProperties: {
      '--gradient-via-position': { inherits: false, syntax: '*' },
    },
  },
}
