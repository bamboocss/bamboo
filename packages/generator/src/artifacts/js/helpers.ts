import { outdent } from 'outdent'
import helpersMjs from '../generated/helpers.mjs.json' with { type: 'json' }

export function generateHelpers() {
  return {
    js: outdent`
  ${helpersMjs.content}

  export function __spreadValues(a, b) {
    return { ...a, ...b }
  }

  export function __objRest(source, exclude) {
    return Object.fromEntries(Object.entries(source).filter(([key]) => !exclude.includes(key)))
  }
  `,
  }
}
