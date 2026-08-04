import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

export function generatePreactJsxFactory(ctx: Context) {
  const { factoryName, componentName } = ctx.jsx

  return {
    js: outdent`
    import { h } from 'preact'
    import { forwardRef } from 'preact/compat'
    ${ctx.file.import(
      'defaultShouldForwardProp, composeShouldForwardProps, composeCvaFn, getDisplayName',
      './factory-helper',
    )}
    ${ctx.file.import('isCssProperty', './is-valid-prop')}
    ${ctx.file.import('css, cx, cva', '../css/index')}
    ${ctx.file.import('splitProps, normalizeHTMLProps', '../helpers')}

    function styledFn(Dynamic, configOrCva = {}, options = {}) {
      const cvaFn = configOrCva.__cva__ || configOrCva.__recipe__ ? configOrCva : cva(configOrCva)

      const forwardFn = options.shouldForwardProp || defaultShouldForwardProp
      const shouldForwardProp = (prop) => {
        if (options.forwardProps?.includes(prop)) return true
        return forwardFn(prop, cvaFn.variantKeys)
      }

      const defaultProps = Object.assign(
        options.dataAttr && configOrCva.__name__ ? { 'data-recipe': configOrCva.__name__ } : {},
        options.defaultProps,
      )

      const __cvaFn__ = composeCvaFn(Dynamic.__cva__, cvaFn)
      const __shouldForwardProps__ = composeShouldForwardProps(Dynamic, shouldForwardProp)
      const __base__ = Dynamic.__base__ || Dynamic

      const ${componentName} = /* @__PURE__ */ forwardRef(function ${componentName}(props, ref) {
        const { as: Element = __base__, unstyled, children, ...restProps } = props


        // Not memoized, deliberately. \`restProps\` is rest destructuring, so it is a fresh
        // object on every render and a dependency on it can never match — a memo here is a
        // guaranteed miss that still costs a hook slot, a deps array and a retained cell.
        const combinedProps = Object.assign({}, defaultProps, restProps)

        const [htmlProps, forwardedProps, variantProps, styleProps, elementProps] =
          splitProps(combinedProps, normalizeHTMLProps.keys, __shouldForwardProps__, __cvaFn__.variantKeys, isCssProperty)

        function recipeClass() {
          const { css: cssStyles, ...propStyles } = styleProps
          const compoundVariantStyles = __cvaFn__.__getCompoundVariantCss__?.(variantProps)
          return cx(__cvaFn__(variantProps, false), css(compoundVariantStyles, propStyles, cssStyles), combinedProps.class, combinedProps.className)
        }

        function cvaClass() {
          const { css: cssStyles, ...propStyles } = styleProps
          const cvaStyles = __cvaFn__.raw(variantProps)
          return cx(css(cvaStyles, propStyles, cssStyles), combinedProps.class, combinedProps.className)
        }

        const classes = () => {
          if (unstyled) {
            const { css: cssStyles, ...propStyles } = styleProps
            return cx(css(propStyles, cssStyles), combinedProps.class, combinedProps.className)
          }
          return configOrCva.__recipe__ ? recipeClass() : cvaClass()
        }

        return h(Element, {
          ...forwardedProps,
          ...elementProps,
          ...normalizeHTMLProps(htmlProps),
          ref,
          className: classes()
        }, children ?? combinedProps.children)
      })

      const name = getDisplayName(__base__)

      ${componentName}.displayName = \`${factoryName}.\${name}\`
      ${componentName}.__cva__ = __cvaFn__
      ${componentName}.__base__ = __base__
      ${componentName}.__shouldForwardProps__ = shouldForwardProp

      return ${componentName}
    }

    function createJsxFactory() {
      const cache = new Map()

      return new Proxy(styledFn, {
        apply(_, __, args) {
          return styledFn(...args)
        },
        get(_, el) {
          if (!cache.has(el)) {
            cache.set(el, styledFn(el))
          }
          return cache.get(el)
        },
      })
    }

    export const ${factoryName} = /* @__PURE__ */ createJsxFactory()
    `,
  }
}
