import type { Context } from '@bamboocss/core'
import { BambooError, uniq } from '@bamboocss/shared'
import { outdent } from 'outdent'
import { match } from 'ts-pattern'
import isValidPropJson from '../generated/is-valid-prop.mjs.json' assert { type: 'json' }

// This targets the bundler's output, not the source: it inlines the string constants,
// so `const userGeneratedStr = ''` arrives as `"".split(",")` and there is no named
// variable left to match. Both declarations are matched together because they are
// rewritten into a single deduplicated list.
const cssPropListRegex =
  /const userGenerated = ".*?"\.split\(","\);\s*const allCssProperties = "(.*?)"\.split\(","\)\.concat\(userGenerated\);/
// Matches whichever binding keyword the bundler emits: it produced `var` before
// the tsdown migration and `const` after, and a miss here leaves the local `memo`
// in place alongside the imported one, which is a duplicate declaration.
const memoFnDeclarationRegex = /function memo(?:.+?)\n((?:var|const|let) cssPropertySelectorRegex)/s

export function generateIsValidProp(ctx: Context) {
  if (ctx.isTemplateLiteralSyntax) return
  let content = isValidPropJson.content

  const propertyList = content.match(cssPropListRegex)

  // Silently emitting an empty list would ship a system where every style prop leaks
  // to the DOM as an HTML attribute, so refuse rather than degrade.
  if (!propertyList) {
    throw new BambooError(
      'NOT_FOUND',
      'Could not find the property list in the prebuilt is-valid-prop module. Its bundled shape has changed.',
    )
  }

  const userProperties = match(ctx.jsx.styleProps)
    .with('all', () => Array.from(ctx.properties))
    .with('minimal', () => ['css'])
    .with('none', () => ['css'])
    .exhaustive()

  // The two lists overlap heavily — around 285 of the browser properties are also
  // project properties — and the runtime only ever reads their union, so emit it once.
  // `minimal` and `none` do not accept arbitrary CSS properties on JSX, which makes the
  // browser list dead weight there.
  const browserProperties = ctx.jsx.styleProps === 'all' ? propertyList[1].split(',') : []

  // Replacing via a function so that a `$` in a project property is not read as a
  // replacement pattern.
  content = content.replace(
    cssPropListRegex,
    () => `const allCssProperties = "${uniq(browserProperties, userProperties).join(',')}".split(",");`,
  )

  // replace memo function declaration with an import from helpers
  content = content.replace(memoFnDeclarationRegex, '$1')

  // remove the memo function call when not needed
  if (ctx.jsx.styleProps === 'minimal' || ctx.jsx.styleProps === 'none') {
    content = content.replace('/* @__PURE__ */ memo(', '/* @__PURE__ */ (')
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
