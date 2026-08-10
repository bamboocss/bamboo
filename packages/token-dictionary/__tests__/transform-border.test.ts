import { expect, test } from 'vitest'
import { TokenDictionary } from '../src/dictionary'
import { addConditionalCssVariables, addCssVariables, transformBorders } from '../src/transform'

test('transform / border', () => {
  const dictionary = new TokenDictionary({
    tokens: {
      colors: {
        red: { value: '#ff0000' },
      },
      borderWidths: {
        thick: { value: '2px' },
      },
      borders: {
        sm: { value: '1px solid token(colors.red)' },
        md: { value: { width: 2, style: 'solid', color: 'token(colors.red)' } },
        lg: { value: { width: '2px', style: 'solid', color: 'pink' } },
        xl: { value: { width: '2', style: 'dashed', color: 'green' } },
        brand: { value: { width: 'token(borderWidths.thick)', color: '#fff', style: 'solid' } },
      },
    },
    semanticTokens: {
      borders: {
        controlBorder: {
          value: { base: 'token(borders.sm)', '@hover': 'token(borders.md)' },
        },
        dividerBorder: {
          value: 'token(borders.controlBorder)',
        },
      },
    },
  })

  dictionary.registerTokens()
  dictionary.registerTransform(transformBorders, addCssVariables, addConditionalCssVariables)

  dictionary.build()

  expect(dictionary.allTokens).toMatchInlineSnapshot(`
    [
      Token {
        "deprecated": undefined,
        "description": undefined,
        "extensions": {
          "category": "colors",
          "condition": "base",
          "prop": "red",
          "var": "--colors-red",
          "varRef": "var(--colors-red)",
        },
        "name": "colors.red",
        "originalValue": "#ff0000",
        "path": [
          "colors",
          "red",
        ],
        "type": "color",
        "value": "#ff0000",
      },
      Token {
        "deprecated": undefined,
        "description": undefined,
        "extensions": {
          "category": "borderWidths",
          "condition": "base",
          "prop": "thick",
          "var": "--border-widths-thick",
          "varRef": "var(--border-widths-thick)",
        },
        "name": "borderWidths.thick",
        "originalValue": "2px",
        "path": [
          "borderWidths",
          "thick",
        ],
        "type": "borderWidth",
        "value": "2px",
      },
      Token {
        "deprecated": undefined,
        "description": undefined,
        "extensions": {
          "category": "borders",
          "condition": "base",
          "prop": "sm",
          "var": "--borders-sm",
          "varRef": "var(--borders-sm)",
        },
        "name": "borders.sm",
        "originalValue": "1px solid token(colors.red)",
        "path": [
          "borders",
          "sm",
        ],
        "type": "border",
        "value": "1px solid var(--colors-red)",
      },
      Token {
        "deprecated": undefined,
        "description": undefined,
        "extensions": {
          "category": "borders",
          "condition": "base",
          "prop": "md",
          "var": "--borders-md",
          "varRef": "var(--borders-md)",
        },
        "name": "borders.md",
        "originalValue": "2px solid token(colors.red)",
        "path": [
          "borders",
          "md",
        ],
        "type": "border",
        "value": "2px solid var(--colors-red)",
      },
      Token {
        "deprecated": undefined,
        "description": undefined,
        "extensions": {
          "category": "borders",
          "condition": "base",
          "prop": "lg",
          "var": "--borders-lg",
          "varRef": "var(--borders-lg)",
        },
        "name": "borders.lg",
        "originalValue": "2px solid pink",
        "path": [
          "borders",
          "lg",
        ],
        "type": "border",
        "value": "2px solid pink",
      },
      Token {
        "deprecated": undefined,
        "description": undefined,
        "extensions": {
          "category": "borders",
          "condition": "base",
          "prop": "xl",
          "var": "--borders-xl",
          "varRef": "var(--borders-xl)",
        },
        "name": "borders.xl",
        "originalValue": "2px dashed green",
        "path": [
          "borders",
          "xl",
        ],
        "type": "border",
        "value": "2px dashed green",
      },
      Token {
        "deprecated": undefined,
        "description": undefined,
        "extensions": {
          "category": "borders",
          "condition": "base",
          "prop": "brand",
          "var": "--borders-brand",
          "varRef": "var(--borders-brand)",
        },
        "name": "borders.brand",
        "originalValue": "token(borderWidths.thick) solid #fff",
        "path": [
          "borders",
          "brand",
        ],
        "type": "border",
        "value": "var(--border-widths-thick) solid #fff",
      },
      Token {
        "deprecated": undefined,
        "description": undefined,
        "extensions": {
          "category": "borders",
          "condition": "base",
          "conditions": {
            "@hover": "var(--borders-md)",
            "base": "var(--borders-sm)",
          },
          "prop": "controlBorder",
          "rawValue": {
            "@hover": "token(borders.md)",
            "base": "token(borders.sm)",
          },
          "var": "--borders-control-border",
          "varRef": "var(--borders-control-border)",
        },
        "name": "borders.controlBorder",
        "originalValue": "token(borders.sm)",
        "path": [
          "borders",
          "controlBorder",
        ],
        "type": "border",
        "value": "var(--borders-sm)",
      },
      Token {
        "deprecated": undefined,
        "description": undefined,
        "extensions": {
          "category": "borders",
          "condition": "base",
          "conditions": {
            "base": "var(--borders-control-border)",
          },
          "prop": "dividerBorder",
          "rawValue": {
            "base": "token(borders.controlBorder)",
          },
          "var": "--borders-divider-border",
          "varRef": "var(--borders-divider-border)",
        },
        "name": "borders.dividerBorder",
        "originalValue": "token(borders.controlBorder)",
        "path": [
          "borders",
          "dividerBorder",
        ],
        "type": "border",
        "value": "var(--borders-control-border)",
      },
      Token {
        "deprecated": undefined,
        "description": undefined,
        "extensions": {
          "category": "borders",
          "condition": "@hover",
          "conditions": {
            "@hover": "var(--borders-md)",
            "base": "var(--borders-sm)",
          },
          "prop": "controlBorder",
          "rawValue": {
            "@hover": "token(borders.md)",
            "base": "token(borders.sm)",
          },
          "var": "--borders-control-border",
          "varRef": "var(--borders-control-border)",
        },
        "name": "borders.controlBorder",
        "originalValue": "token(borders.sm)",
        "path": [
          "borders",
          "controlBorder",
        ],
        "type": "border",
        "value": "var(--borders-md)",
      },
    ]
  `)
})
