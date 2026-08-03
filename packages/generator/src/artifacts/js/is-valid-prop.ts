import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'
import { match } from 'ts-pattern'
import isValidPropJson from '../generated/is-valid-prop.mjs.json' assert { type: 'json' }

// These target the bundler's output, not the source: it inlines the string
// constants, so `const userGeneratedStr = ''` arrives as `"".split(",")` and there
// is no named variable left to match. A miss is silent — the generated file still
// parses, it just carries an empty property list — so both are asserted in
// `is-valid-prop.test.ts`.
const userGeneratedRegex = /const userGenerated = "(.*?)"\.split\(","\);/
const cssPropRegex = /const allCssProperties = "(.*?)"\.split\(","\)/
// Matches whichever binding keyword the bundler emits: it produced `var` before
// the tsdown migration and `const` after, and a miss here leaves the local `memo`
// in place alongside the imported one, which is a duplicate declaration.
const memoFnDeclarationRegex = /function memo(?:.+?)\n((?:var|const|let) cssPropertySelectorRegex)/s

export function generateIsValidProp(ctx: Context) {
  if (ctx.isTemplateLiteralSyntax) return
  let content = isValidPropJson.content

  // replace user generated props by those from ctx, `css` or nothing
  content = content.replace(
    userGeneratedRegex,
    `const userGenerated = "${match(ctx.jsx.styleProps)
      .with('all', () => Array.from(ctx.properties).join(','))
      .with('minimal', () => 'css')
      .with('none', () => 'css')
      .exhaustive()}".split(",");`,
  )

  // replace memo function declaration with an import from helpers
  content = content.replace(memoFnDeclarationRegex, '$1')

  // remove browser CSS props / memo function call when not needed
  if (ctx.jsx.styleProps === 'minimal' || ctx.jsx.styleProps === 'none') {
    content = content.replace('/* @__PURE__ */ memo(', '/* @__PURE__ */ (')
    content = content.replace(cssPropRegex, 'const allCssProperties = "".split(",")')
  } else {
    // we want memo if we're using style props
    content = ctx.file.import('memo', '../helpers') + '\n' + content
  }

  content = ctx.file.import('splitProps', '../helpers') + '\n' + content
  content += `export const splitCssProps = (props) =>  splitProps(props, isCssProperty)`

  return {
    js: content,
    dts: outdent`
    import type { DistributiveOmit, HTMLBambooProps, JsxStyleProps, Pretty } from '../types';

    declare const isCssProperty: (value: string) => boolean;

    type CssPropKey = keyof JsxStyleProps
    type OmittedCssProps<T> = Pretty<DistributiveOmit<T, CssPropKey>>

    declare const splitCssProps: <T>(props: T) => [JsxStyleProps, OmittedCssProps<T>]

    export { isCssProperty, splitCssProps };
    `,
  }
}
