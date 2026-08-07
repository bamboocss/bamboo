import type { UtilityConfig } from '@bamboocss/types'

const positiveFractions = {
  '1/2': '50%',
  '1/3': '33.333333%',
  '2/3': '66.666667%',
  '1/4': '25%',
  '2/4': '50%',
  '3/4': '75%',
  full: '100%',
}
const negativeFractions = Object.fromEntries(
  Object.entries(positiveFractions).map(([key, value]) => [`-${key}`, `-${value}`]),
)
const fractions = { ...positiveFractions, ...negativeFractions }

export const transforms: UtilityConfig = {
  transformOrigin: {
    className: 'trf-o',
    group: 'Transform',
  },
  transformBox: {
    className: 'trf-b',
    group: 'Transform',
  },
  transformStyle: {
    className: 'trf-s',
    group: 'Transform',
  },
  transform: {
    className: 'trf',
    group: 'Transform',
  },
  rotate: {
    className: 'rotate',
    group: 'Transform',
    property: 'rotate',
    values: {
      auto: 'var(--rotate-x) var(--rotate-y)',
      'auto-3d': 'var(--rotate-x) var(--rotate-y) var(--rotate-z)',
    },
    // Read without a fallback, so each needs an initial value of its own: an unset axis has
    // to compose to no rotation rather than take the whole declaration down with it.
    customProperties: {
      '--rotate-x': { inherits: false, initialValue: '0', syntax: '*' },
      '--rotate-y': { inherits: false, initialValue: '0', syntax: '*' },
      '--rotate-z': { inherits: false, initialValue: '0', syntax: '*' },
    },
  },
  rotateX: {
    className: 'rotate-x',
    group: 'Transform',
    property: 'rotate',
    transform(value) {
      return {
        '--rotate-x': value,
      }
    },
  },
  rotateY: {
    className: 'rotate-y',
    group: 'Transform',
    property: 'rotate',
    transform(value) {
      return {
        '--rotate-y': value,
      }
    },
  },
  rotateZ: {
    className: 'rotate-z',
    group: 'Transform',
    property: 'rotate',
    transform(value) {
      return {
        '--rotate-z': value,
      }
    },
  },
  scale: {
    className: 'scale',
    group: 'Transform',
    property: 'scale',
    values: {
      auto: 'var(--scale-x) var(--scale-y)',
    },
    // `1`, not `0`: an unset axis has to compose to the identity scale.
    customProperties: {
      '--scale-x': { inherits: false, initialValue: '1', syntax: '*' },
      '--scale-y': { inherits: false, initialValue: '1', syntax: '*' },
    },
  },
  scaleX: {
    className: 'scale-x',
    group: 'Transform',
    transform(value) {
      return {
        '--scale-x': value,
      }
    },
  },
  scaleY: {
    className: 'scale-y',
    group: 'Transform',
    transform(value) {
      return {
        '--scale-y': value,
      }
    },
  },
  translate: {
    className: 'translate',
    group: 'Transform',
    property: 'translate',
    values: {
      auto: 'var(--translate-x) var(--translate-y)',
      'auto-3d': 'var(--translate-x) var(--translate-y) var(--translate-z)',
    },
    customProperties: {
      '--translate-x': { inherits: false, initialValue: '0', syntax: '*' },
      '--translate-y': { inherits: false, initialValue: '0', syntax: '*' },
      '--translate-z': { inherits: false, initialValue: '0', syntax: '*' },
    },
  },
  translateX: {
    shorthand: 'x',
    className: 'translate-x',
    group: 'Transform',
    values(theme) {
      return {
        ...theme('spacing'),
        ...fractions,
      }
    },
    transform(value) {
      return {
        '--translate-x': value,
      }
    },
  },
  translateY: {
    shorthand: 'y',
    className: 'translate-y',
    group: 'Transform',
    values(theme) {
      return {
        ...theme('spacing'),
        ...fractions,
      }
    },
    transform(value) {
      return {
        '--translate-y': value,
      }
    },
  },
  translateZ: {
    shorthand: 'z',
    className: 'translate-z',
    group: 'Transform',
    values(theme) {
      return {
        ...theme('spacing'),
        ...fractions,
      }
    },
    transform(value) {
      return {
        '--translate-z': value,
      }
    },
  },
}
