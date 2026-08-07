import type { UtilityConfig } from '@bamboocss/types'

export const tables: UtilityConfig = {
  borderCollapse: {
    className: 'bd-cl',
    group: 'Table',
  },
  borderSpacing: {
    className: 'bd-sp',
    group: 'Table',
    values(theme) {
      return {
        ...theme('spacing'),
        auto: 'var(--border-spacing-x) var(--border-spacing-y)',
      }
    },
    customProperties: {
      '--border-spacing-x': { inherits: false, initialValue: '0', syntax: '*' },
      '--border-spacing-y': { inherits: false, initialValue: '0', syntax: '*' },
    },
  },
  borderSpacingX: {
    className: 'bd-sx',
    values: 'spacing',
    group: 'Table',
    transform(value) {
      return {
        '--border-spacing-x': value,
      }
    },
  },
  borderSpacingY: {
    className: 'bd-sy',
    values: 'spacing',
    group: 'Table',
    transform(value) {
      return {
        '--border-spacing-y': value,
      }
    },
  },
  tableLayout: {
    className: 'tbl',
    group: 'Table',
  },
}
