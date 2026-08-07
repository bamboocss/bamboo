import { describe, expect, test } from 'vitest'
import { parseAndExtract } from './fixture'

describe('cssMode config', () => {
  test('css() produces a single grouped class when cssMode is grouped', () => {
    const code = `
    import { css } from "styled-system/css"

    css({ color: "red", padding: "8px" })
    `

    const result = parseAndExtract(code, { cssMode: 'grouped' })

    expect(result.encoder.grouped.size).toBe(1)
    expect(result.encoder.atomic.size).toBe(0)

    expect(result.css).toContain('color: red')
    expect(result.css).toContain('padding: 8px')

    const classMatches = result.css.match(/\.\w+\s*\{/g) ?? []
    expect(classMatches).toHaveLength(1)
  })

  test('css() remains atomic when cssMode is not set', () => {
    const code = `
    import { css } from "styled-system/css"

    css({ color: "red", padding: "8px" })
    `

    const result = parseAndExtract(code)

    expect(result.encoder.grouped.size).toBe(0)
    expect(result.encoder.atomic.size).toBe(2)
  })

  test('grouped css() with conditions', () => {
    const code = `
    import { css } from "styled-system/css"

    css({
      color: "blue",
      _hover: { color: "red" }
    })
    `

    const result = parseAndExtract(code, { cssMode: 'grouped' })

    expect(result.encoder.grouped.size).toBe(1)
    expect(result.css).toContain('color: blue')
    expect(result.css).toContain('color: red')
    expect(result.css).toContain(':hover')
  })

  test('multiple css() calls produce separate groups', () => {
    const code = `
    import { css } from "styled-system/css"

    css({ color: "red" })
    css({ padding: "8px" })
    `

    const result = parseAndExtract(code, { cssMode: 'grouped' })

    expect(result.encoder.grouped.size).toBe(2)
  })

  test('identical css() calls are deduplicated', () => {
    const code = `
    import { css } from "styled-system/css"

    css({ color: "red", padding: "8px" })
    css({ color: "red", padding: "8px" })
    `

    const result = parseAndExtract(code, { cssMode: 'grouped' })

    expect(result.encoder.grouped.size).toBe(1)
  })

  test('recipes are unaffected by cssMode', () => {
    const code = `
    import { css } from "styled-system/css"

    css({ color: "red" })
    `

    const result = parseAndExtract(code, { cssMode: 'grouped' })

    expect(result.encoder.grouped.size).toBe(1)
    expect(result.encoder.recipes.size).toBe(0)
  })
})

describe('extract to css output pipeline', () => {
  test('css with base', () => {
    const code = `
    import { css } from "styled-system/css"

    css({
      base: { color: "blue" },
      md: { color: "red" }
    })
    `

    const result = parseAndExtract(code)

    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "base": {
                "color": "blue",
              },
              "md": {
                "color": "red",
              },
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .c_blue {
          color: blue;
      }

        @media (width >= 48rem) {
          .md\\:c_red {
            color: red;
      }
      }
      }"
    `)
  })

  test('basic usage', () => {
    const code = `
      import { css } from "styled-system/css"

      const color = "red.100";

       function Button({ position = "relative", inset: aliasedInset = 0, ...props }) {
         return (
            <div marginTop="55555px">
              <div className={css({
                position,
                inset: aliasedInset,
                color: "blue.100",
                backgroundImage: \`url("https://raw.githubusercontent.com/bamboocss/bamboocss/main/media/logo-colored@2x.png?raw=true")\`,
                border: "1px solid token(colors.yellow.100)",
                "--shadow": {
                  base: "colors.orange.100",
                  _dark: "colors.gray.800",
                },
                boxShadow: "0 0 0 4px var(--shadow)",
                outlineColor: "var(--colors-pink-200)",
              })} />
              <div className={css({
                p: "2",
                md: {
                  m: {
                    base: "1px",
                    sm: "4px",
                  },
                  color,
                  _dark: { _hover: { m: -2 } }
                },
                _hover: { color: "#2ecc71", backgroundColor: "var(--some-bg)" }
              })}>Click me</div>
            </div>
        )
       }
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "--shadow": {
                "_dark": "colors.gray.800",
                "base": "colors.orange.100",
              },
              "backgroundImage": "url("https://raw.githubusercontent.com/bamboocss/bamboocss/main/media/logo-colored@2x.png?raw=true")",
              "border": "1px solid token(colors.yellow.100)",
              "boxShadow": "0 0 0 4px var(--shadow)",
              "color": "blue.100",
              "inset": 0,
              "outlineColor": "var(--colors-pink-200)",
              "position": "relative",
            },
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {
              "_hover": {
                "backgroundColor": "var(--some-bg)",
                "color": "#2ecc71",
              },
              "md": {
                "_dark": {
                  "_hover": {
                    "m": -2,
                  },
                },
                "color": "red.100",
                "m": {
                  "base": "1px",
                  "sm": "4px",
                },
              },
              "p": "2",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .\\--shadow_colors\\.orange\\.100 {
          --shadow: var(--colors-orange-100);
      }

        .inset_0 {
          inset: var(--spacing-0);
      }

        .bd_1px_solid_token\\(colors\\.yellow\\.100\\) {
          border: 1px solid var(--colors-yellow-100);
      }

        .p_2 {
          padding: var(--spacing-2);
      }

        .pos_relative {
          position: relative;
      }

        .c_blue\\.100 {
          color: var(--colors-blue-100);
      }

        .bg-i_url\\(\\"https\\:\\/\\/raw\\.githubusercontent\\.com\\/bamboocss\\/bamboocss\\/main\\/media\\/logo-colored\\@2x\\.png\\?raw\\=true\\"\\) {
          background-image: url("https://raw.githubusercontent.com/bamboocss/bamboocss/main/media/logo-colored@2x.png?raw=true");
      }

        .bx-sh_0_0_0_4px_var\\(--shadow\\) {
          box-shadow: 0 0 0 4px var(--shadow);
      }

        .ring-c_var\\(--colors-pink-200\\) {
          outline-color: var(--colors-pink-200);
      }

        [data-theme=dark] .dark\\:--shadow_colors\\.gray\\.800,.dark .dark\\:--shadow_colors\\.gray\\.800,.dark\\:--shadow_colors\\.gray\\.800.dark,.dark\\:--shadow_colors\\.gray\\.800[data-theme=dark] {
          --shadow: var(--colors-gray-800);
      }

        .hover\\:c_\\#2ecc71:is(:hover, [data-hover]) {
          color: #2ecc71;
      }

        .hover\\:bg-c_var\\(--some-bg\\):is(:hover, [data-hover]) {
          background-color: var(--some-bg);
      }

        @media (width >= 48rem) {
          .md\\:m_1px {
            margin: 1px;
      }
          .md\\:c_red\\.100 {
            color: var(--colors-red-100);
      }
          [data-theme=dark] .md\\:dark\\:hover\\:m_-2:is(:hover, [data-hover]),.dark .md\\:dark\\:hover\\:m_-2:is(:hover, [data-hover]),.md\\:dark\\:hover\\:m_-2.dark:is(:hover, [data-hover]),.md\\:dark\\:hover\\:m_-2[data-theme=dark]:is(:hover, [data-hover]) {
            margin: calc(var(--spacing-2) * -1);
      }
      }

        @media (width >= 48rem) {
          @media (width >= 40rem) {
            .md\\:sm\\:m_4px {
              margin: 4px;
      }
      }
      }
      }"
    `)
  })

  test('basic usage with multiple style objects', () => {
    const code = `
      import { css } from "styled-system/css"

      css({ mx: '3', paddingTop: '4' }, { mx: '10', pt: '6' })
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "mx": "3",
              "paddingTop": "4",
            },
            {
              "mx": "10",
              "pt": "6",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .mx_3 {
          margin-inline: var(--spacing-3);
      }

        .mx_10 {
          margin-inline: var(--spacing-10);
      }

        .pt_4 {
          padding-top: var(--spacing-4);
      }

        .pt_6 {
          padding-top: var(--spacing-6);
      }
      }"
    `)
  })

  test('multiple recipes on 1 component', () => {
    const code = `
    import { button, pinkRecipe, greenRecipe, blueRecipe, sizeRecipe, bgRecipe } from "styled-system/recipes"

    const ComponentWithMultipleRecipes = ({ variant, size, color }) => {
      return <button className={cx(pinkRecipe({ variant }), greenRecipe({ variant }), blueRecipe({ variant }), sizeRecipe({ size }), bgRecipe({ color }))}>Hello</button>
    }


    export default function Page() {
      return (
        <>
          <ComponentWithMultipleRecipes variant="small" size="medium" color="yellow" />
        </>
      )
    }
     `
    const result = parseAndExtract(code, {
      theme: {
        extend: {
          recipes: {
            pinkRecipe: {
              className: 'pinkRecipe',
              jsx: ['ComponentWithMultipleRecipes'],
              base: { color: 'pink.100' },
              variants: {
                variant: {
                  small: { fontSize: 'sm' },
                },
              },
            },
            greenRecipe: {
              className: 'greenRecipe',
              jsx: ['ComponentWithMultipleRecipes'],
              base: { color: 'green.100' },
              variants: {
                variant: {
                  small: { fontSize: 'sm' },
                },
              },
            },
            blueRecipe: {
              className: 'blueRecipe',
              jsx: ['ComponentWithMultipleRecipes'],
              base: { color: 'blue.100' },
              variants: {
                variant: {
                  small: { fontSize: 'sm' },
                },
              },
            },
            sizeRecipe: {
              className: 'sizeRecipe',
              jsx: ['ComponentWithMultipleRecipes'],
              variants: {
                size: {
                  medium: { fontSize: 'md' },
                  large: { fontSize: 'lg' },
                },
              },
            },
            bgRecipe: {
              className: 'bgRecipe',
              jsx: ['ComponentWithMultipleRecipes'],
              variants: {
                color: {
                  yellow: { backgroundColor: 'yellow.100' },
                },
              },
            },
          },
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {},
          ],
          "name": "pinkRecipe",
          "type": "recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "greenRecipe",
          "type": "recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "blueRecipe",
          "type": "recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "sizeRecipe",
          "type": "recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "bgRecipe",
          "type": "recipe",
        },
        {
          "data": [
            {
              "color": "yellow",
              "size": "medium",
              "variant": "small",
            },
          ],
          "name": "ComponentWithMultipleRecipes",
          "type": "jsx-recipe",
        },
        {
          "data": [
            {
              "color": "yellow",
              "size": "medium",
              "variant": "small",
            },
          ],
          "name": "ComponentWithMultipleRecipes",
          "type": "jsx-recipe",
        },
        {
          "data": [
            {
              "color": "yellow",
              "size": "medium",
              "variant": "small",
            },
          ],
          "name": "ComponentWithMultipleRecipes",
          "type": "jsx-recipe",
        },
        {
          "data": [
            {
              "color": "yellow",
              "size": "medium",
              "variant": "small",
            },
          ],
          "name": "ComponentWithMultipleRecipes",
          "type": "jsx-recipe",
        },
        {
          "data": [
            {
              "color": "yellow",
              "size": "medium",
              "variant": "small",
            },
          ],
          "name": "ComponentWithMultipleRecipes",
          "type": "jsx-recipe",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes {
        .pinkRecipe {
          color: var(--colors-pink-100);
      }

        .greenRecipe {
          color: var(--colors-green-100);
      }

        .blueRecipe {
          color: var(--colors-blue-100);
      }

        .pinkRecipe--variant_small,.greenRecipe--variant_small,.blueRecipe--variant_small {
          font-size: var(--font-sizes-sm);
      }

        .sizeRecipe--size_medium {
          font-size: var(--font-sizes-md);
      }

        .bgRecipe--color_yellow {
          background-color: var(--colors-yellow-100);
      }
      }

      @layer utilities {
        .c_yellow {
          color: yellow;
      }
      }"
    `)
  })

  test('multiple recipes on 1 component using {recipe}.raw', () => {
    const code = `
    import { button, pinkRecipe, sizeRecipe, bgRecipe } from "styled-system/recipes"

    const ComponentWithMultipleRecipes = ({ pinkProps: { variant } = {}, sizeProps: { size } = {}, colorProps: { color } = {} }) => {
      return <button className={cx(pinkRecipe({ variant }), sizeRecipe({ size }), bgRecipe({ color }))}>Hello</button>
    }


    export default function Page() {
      return (
        <>
          <ComponentWithMultipleRecipes
            pinkProps={pinkRecipe.raw({ variant: "small" })}
            sizeProps={sizeRecipe.raw({ size: "medium" })}
            bgProps={bgRecipe.raw({ color: "yellow" })}
          />
        </>
      )
    }
     `
    const result = parseAndExtract(code, {
      theme: {
        extend: {
          recipes: {
            pinkRecipe: {
              className: 'pinkRecipe',
              jsx: ['ComponentWithMultipleRecipes'],
              base: { color: 'pink.100' },
              variants: {
                variant: {
                  small: { fontSize: 'sm' },
                },
              },
            },
            sizeRecipe: {
              className: 'sizeRecipe',
              jsx: ['ComponentWithMultipleRecipes'],
              variants: {
                size: {
                  medium: { fontSize: 'md' },
                  large: { fontSize: 'lg' },
                },
              },
            },
            bgRecipe: {
              className: 'bgRecipe',
              jsx: ['ComponentWithMultipleRecipes'],
              variants: {
                color: {
                  yellow: { backgroundColor: 'yellow.100' },
                },
              },
            },
          },
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {},
          ],
          "name": "pinkRecipe",
          "type": "recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "sizeRecipe",
          "type": "recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "bgRecipe",
          "type": "recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "ComponentWithMultipleRecipes",
          "type": "jsx-recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "ComponentWithMultipleRecipes",
          "type": "jsx-recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "ComponentWithMultipleRecipes",
          "type": "jsx-recipe",
        },
        {
          "data": [
            {
              "variant": "small",
            },
          ],
          "name": "pinkRecipe",
          "type": "recipe",
        },
        {
          "data": [
            {
              "size": "medium",
            },
          ],
          "name": "sizeRecipe",
          "type": "recipe",
        },
        {
          "data": [
            {
              "color": "yellow",
            },
          ],
          "name": "bgRecipe",
          "type": "recipe",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes {
        .pinkRecipe {
          color: var(--colors-pink-100);
      }

        .pinkRecipe--variant_small {
          font-size: var(--font-sizes-sm);
      }

        .sizeRecipe--size_medium {
          font-size: var(--font-sizes-md);
      }

        .bgRecipe--color_yellow {
          background-color: var(--colors-yellow-100);
      }
      }"
    `)
  })

  test('empty rules', () => {
    const code = `
    import { SectionLearn } from '@/components/sections/learn'
    import { SectionVideos } from '@/components/sections/learn-video'

    export default function Page() {
      return (
        <>
          <SectionLearn />
          <SectionVideos />
        </>
      )
    }

     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`[]`)

    expect(result.css).toMatchInlineSnapshot('""')
  })

  test('runtime conditions', () => {
    const code = `
      import { css } from "styled-system/css"

       function Button() {
        const [isHovered, setIsHovered] = useState(false)

         return (
          <div className={css({ color: isHovered ? "blue.100" : "red.100" })} />
        )
       }
     `

    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "color": "blue.100",
            },
            {
              "color": "red.100",
            },
            {},
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .c_blue\\.100 {
          color: var(--colors-blue-100);
      }

        .c_red\\.100 {
          color: var(--colors-red-100);
      }
      }"
    `)
  })

  test('arbitrary selectors', () => {
    const code = `
      import { css } from "styled-system/css"

       function Button() {

         return (
          <div className={css({
            [".closed > &"]: {
              color: "green.100",
              _dark: { color: "green.900" }
            },
            ["& + &"]: {
              margin: "-2px",
              _hover: { margin: 0 }
            },
            ["&[data-state='open']"]: {
              cursor: "pointer",
              _before: {
                content: '"👋"',
              }
            },
          })} />
        )
       }
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "& + &": {
                "_hover": {
                  "margin": 0,
                },
                "margin": "-2px",
              },
              "&[data-state='open']": {
                "_before": {
                  "content": ""👋"",
                },
                "cursor": "pointer",
              },
              ".closed > &": {
                "_dark": {
                  "color": "green.900",
                },
                "color": "green.100",
              },
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        :is(.\\[\\&_\\+_\\&\\]\\:m_-2px) + :is(.\\[\\&_\\+_\\&\\]\\:m_-2px) {
          margin: -2px;
      }

        .closed > .\\[\\.closed_\\>_\\&\\]\\:c_green\\.100 {
          color: var(--colors-green-100);
      }

        .\\[\\&\\[data-state\\=\\'open\\'\\]\\]\\:cursor_pointer[data-state='open'] {
          cursor: pointer;
      }

        :is(.\\[\\&_\\+_\\&\\]\\:hover\\:m_0) + :is(.\\[\\&_\\+_\\&\\]\\:hover\\:m_0):is(:hover, [data-hover]) {
          margin: var(--spacing-0);
      }

        [data-theme=dark] .closed > .\\[\\.closed_\\>_\\&\\]\\:dark\\:c_green\\.900,.dark .closed > .\\[\\.closed_\\>_\\&\\]\\:dark\\:c_green\\.900,.closed > .\\[\\.closed_\\>_\\&\\]\\:dark\\:c_green\\.900.dark,.closed > .\\[\\.closed_\\>_\\&\\]\\:dark\\:c_green\\.900[data-theme=dark] {
          color: var(--colors-green-900);
      }

        .\\[\\&\\[data-state\\=\\'open\\'\\]\\]\\:before\\:content_\\"👋\\"[data-state='open']::before {
          content: "👋";
      }
      }"
    `)
  })

  test('colorPalette', () => {
    const code = `
      import { css } from "styled-system/css"

       function Button() {
         return (
          <div className={css({ colorPalette: "blue", bg: "colorPalette.100", _hover: { color: "colorPalette.300" } })} />
        )
       }
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "_hover": {
                "color": "colorPalette.300",
              },
              "bg": "colorPalette.100",
              "colorPalette": "blue",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .bg_colorPalette\\.100 {
          background: var(--colors-color-palette-100);
      }

        .color-palette_blue {
          --colors-color-palette-50: var(--colors-blue-50);
          --colors-color-palette-100: var(--colors-blue-100);
          --colors-color-palette-200: var(--colors-blue-200);
          --colors-color-palette-300: var(--colors-blue-300);
          --colors-color-palette-400: var(--colors-blue-400);
          --colors-color-palette-500: var(--colors-blue-500);
          --colors-color-palette-600: var(--colors-blue-600);
          --colors-color-palette-700: var(--colors-blue-700);
          --colors-color-palette-800: var(--colors-blue-800);
          --colors-color-palette-900: var(--colors-blue-900);
          --colors-color-palette-950: var(--colors-blue-950);
      }

        .hover\\:c_colorPalette\\.300:is(:hover, [data-hover]) {
          color: var(--colors-color-palette-300);
      }
      }"
    `)
  })

  // https://github.com/bamboocss/bamboo/issues/1062
  describe('issue 1062: expand colorPalette flexibility', () => {
    test('should extract color palette with more than one level of nesting', () => {
      const code = `
      import { css } from "styled-system/css"

      export const App = () => {
        return (
          <>
            <button
              className={css({
                colorPalette: 'button',
                color: 'colorPalette.light',
                backgroundColor: 'colorPalette.dark',
                _hover: {
                  color: 'colorPalette.light.accent',
                  background: 'colorPalette.light.accent.secondary',
                },
              })}
            >
              Root color palette
            </button>
            <button
              className={css({
                colorPalette: 'button.light',
                color: 'colorPalette.accent',
                background: 'colorPalette.accent.secondary',
              })}
            >
              One level deep nested color palette
            </button>
            <button
              className={css({
                colorPalette: 'button.light.accent',
                color: 'colorPalette.secondary',
              })}
            >
              Nested color palette leaf
            </button>
          </>
        );
      };
     `
      const result = parseAndExtract(code, {
        theme: {
          extend: {
            semanticTokens: {
              colors: {
                button: {
                  dark: {
                    value: 'navy',
                  },
                  light: {
                    DEFAULT: {
                      value: 'skyblue',
                    },
                    accent: {
                      DEFAULT: {
                        value: 'cyan',
                      },
                      secondary: {
                        value: 'blue',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      expect(result.json).toMatchInlineSnapshot(`
        [
          {
            "data": [
              {
                "_hover": {
                  "background": "colorPalette.light.accent.secondary",
                  "color": "colorPalette.light.accent",
                },
                "backgroundColor": "colorPalette.dark",
                "color": "colorPalette.light",
                "colorPalette": "button",
              },
            ],
            "name": "css",
            "type": "css",
          },
          {
            "data": [
              {
                "background": "colorPalette.accent.secondary",
                "color": "colorPalette.accent",
                "colorPalette": "button.light",
              },
            ],
            "name": "css",
            "type": "css",
          },
          {
            "data": [
              {
                "color": "colorPalette.secondary",
                "colorPalette": "button.light.accent",
              },
            ],
            "name": "css",
            "type": "css",
          },
        ]
      `)

      expect(result.css).toMatchInlineSnapshot(`
        "@layer utilities {
          .bg_colorPalette\\.accent\\.secondary {
            background: var(--colors-color-palette-accent-secondary);
        }

          .color-palette_button {
            --colors-color-palette-thick: var(--colors-button-thick);
            --colors-color-palette-card-body: var(--colors-button-card-body);
            --colors-color-palette-card-heading: var(--colors-button-card-heading);
            --colors-color-palette-dark: var(--colors-button-dark);
            --colors-color-palette-light: var(--colors-button-light);
            --colors-color-palette-light-accent: var(--colors-button-light-accent);
            --colors-color-palette-light-accent-secondary: var(--colors-button-light-accent-secondary);
        }

          .c_colorPalette\\.light {
            color: var(--colors-color-palette-light);
        }

          .bg-c_colorPalette\\.dark {
            background-color: var(--colors-color-palette-dark);
        }

          .color-palette_button\\.light {
            --colors-color-palette: var(--colors-button-light);
            --colors-color-palette-accent: var(--colors-button-light-accent);
            --colors-color-palette-accent-secondary: var(--colors-button-light-accent-secondary);
        }

          .c_colorPalette\\.accent {
            color: var(--colors-color-palette-accent);
        }

          .color-palette_button\\.light\\.accent {
            --colors-color-palette: var(--colors-button-light-accent);
            --colors-color-palette-secondary: var(--colors-button-light-accent-secondary);
        }

          .c_colorPalette\\.secondary {
            color: var(--colors-color-palette-secondary);
        }

          .hover\\:bg_colorPalette\\.light\\.accent\\.secondary:is(:hover, [data-hover]) {
            background: var(--colors-color-palette-light-accent-secondary);
        }

          .hover\\:c_colorPalette\\.light\\.accent:is(:hover, [data-hover]) {
            color: var(--colors-color-palette-light-accent);
        }
        }"
      `)
    })
  })

  test('patterns', () => {
    const code = `
      import { stack, hstack as aliased } from "styled-system/patterns"

      function Button() {
        return (
          <div>
              <div className={stack({ align: "center" })}>Click me</div>
              <div className={aliased({ justify: "flex-end" })}>Click me</div>
          </div>
        )
      }
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "align": "center",
            },
          ],
          "name": "stack",
          "type": "pattern",
        },
        {
          "data": [
            {
              "justify": "flex-end",
            },
          ],
          "name": "hstack",
          "type": "pattern",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .gap_8px {
          gap: 8px;
      }

        .d_flex {
          display: flex;
      }

        .flex-d_column {
          flex-direction: column;
      }

        .ai_center {
          align-items: center;
      }

        .jc_flex-end {
          justify-content: flex-end;
      }

        .flex-d_row {
          flex-direction: row;
      }
      }"
    `)
  })

  test('should extract config recipes', () => {
    const code = `
      import { button, anotherButton, complexButton } from "styled-system/recipes"

      function AnotherButtonWithRegex({ children, variant, size, css: cssProp }: ButtonProps) {
        return <button className={cx(button({ variant, size }), css(cssProp))}>{children}</button>
      }

      const AnotherButton = ({ spacing }) => {
        return <button className={cx(anotherButton({ spacing }))}>Hello</button>
      }

      const ComplexDesignSystemButton = ({ color }) => {
        return <button className={cx(complexButton({ color }))}>Hello</button>
      }

       function Button() {
         return (
            <div marginTop="55555px">
                <Stack>
                    <AnotherButtonWithRegex variant="danger" size="md" />
                    <AnotherButton spacing="sm" />
                    <ComplexDesignSystemButton color="blue" />
                </Stack>
            </div>
        )
       }
     `
    const result = parseAndExtract(code, {
      theme: {
        extend: {
          recipes: {
            button: {
              className: 'button',
              jsx: ['Button', /WithRegex$/],
              description: 'A button styles',
              base: { fontSize: 'lg' },
              variants: {
                size: {
                  sm: { padding: '2', borderRadius: 'sm' },
                  md: { padding: '4', borderRadius: 'md' },
                },
                variant: {
                  primary: { color: 'white', backgroundColor: 'blue.500' },
                  danger: { color: 'white', backgroundColor: 'red.500' },
                  secondary: { color: 'pink.300', backgroundColor: 'green.500' },
                },
              },
              compoundVariants: [{ variant: 'danger', size: 'md', css: { zIndex: 100 } }],
            },
            anotherButton: {
              className: 'anotherButton',
              jsx: ['AnotherButton'],
              variants: {
                spacing: {
                  sm: { padding: '2', borderRadius: 'sm' },
                  md: { padding: '4', borderRadius: 'md' },
                },
              },
            },
            complexButton: {
              className: 'complexButton',
              jsx: ['ComplexButton', /^Complex.+Button$/],
              variants: {
                color: {
                  blue: { color: 'blue.500' },
                  red: { color: 'red.500' },
                },
              },
            },
          },
        },
      },
    })

    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {},
          ],
          "name": "button",
          "type": "recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {},
          ],
          "name": "anotherButton",
          "type": "recipe",
        },
        {
          "data": [
            {},
          ],
          "name": "complexButton",
          "type": "recipe",
        },
        {
          "data": [
            {
              "size": "md",
              "variant": "danger",
            },
          ],
          "name": "AnotherButtonWithRegex",
          "type": "jsx-recipe",
        },
        {
          "data": [
            {
              "spacing": "sm",
            },
          ],
          "name": "AnotherButton",
          "type": "jsx-recipe",
        },
        {
          "data": [
            {
              "color": "blue",
            },
          ],
          "name": "ComplexDesignSystemButton",
          "type": "jsx-recipe",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes {
        .button {
          font-size: var(--font-sizes-lg);
      }

        .button--variant_danger.button--size_md {
          z-index: 100;
      }

        .button--size_md {
          padding: var(--spacing-4);
          border-radius: var(--radii-md);
      }

        .button--variant_danger {
          color: var(--colors-white);
          background-color: var(--colors-red-500);
      }

        .anotherButton--spacing_sm {
          padding: var(--spacing-2);
          border-radius: var(--radii-sm);
      }

        .complexButton--color_blue {
          color: var(--colors-blue-500);
      }
      }"
    `)
  })

  test('should evaluate ${fn}.raw inside another ${fn}.raw to allow for composition', () => {
    const code = `
    import { css } from 'styled-system/css'

    const paragraphSpacingStyle = css.raw({
      "&:not(:first-child)": { marginBlockEnd: "1em" },
    });

    export const proseCss = css.raw({
      maxWidth: "800px",
      "& p": {
        "&:not(:first-child)": { marginBlockStart: "1em" },
      },
      "& h1": paragraphSpacingStyle,
      "& h2": paragraphSpacingStyle,
    });`

    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "&:not(:first-child)": {
                "marginBlockEnd": "1em",
              },
            },
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {
              "& h1": {
                "&:not(:first-child)": {
                  "marginBlockEnd": "1em",
                },
              },
              "& h2": {
                "&:not(:first-child)": {
                  "marginBlockEnd": "1em",
                },
              },
              "& p": {
                "&:not(:first-child)": {
                  "marginBlockStart": "1em",
                },
              },
              "maxWidth": "800px",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .max-w_800px {
          max-width: 800px;
      }

        .\\[\\&\\:not\\(\\:first-child\\)\\]\\:mbe_1em:not(:first-child) {
          margin-block-end: 1em;
      }

        .\\[\\&_p\\]\\:\\[\\&\\:not\\(\\:first-child\\)\\]\\:mbs_1em p:not(:first-child) {
          margin-block-start: 1em;
      }

        .\\[\\&_h1\\]\\:\\[\\&\\:not\\(\\:first-child\\)\\]\\:mbe_1em h1:not(:first-child),.\\[\\&_h2\\]\\:\\[\\&\\:not\\(\\:first-child\\)\\]\\:mbe_1em h2:not(:first-child) {
          margin-block-end: 1em;
      }
      }"
    `)
  })

  test('should evaluate variants supplied a function', () => {
    const code = `
    import {cva} from "styled-system/css"
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

    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "variants": {
                "px": {
                  "l": {
                    "paddingX": "token(spacing.3)",
                  },
                  "m": {
                    "paddingX": "token(spacing.2)",
                  },
                  "s": {
                    "paddingX": "token(spacing.1)",
                  },
                },
                "py": {
                  "l": {
                    "paddingY": "token(spacing.3)",
                  },
                  "m": {
                    "paddingY": "token(spacing.2)",
                  },
                  "s": {
                    "paddingY": "token(spacing.1)",
                  },
                },
              },
            },
          ],
          "name": "cva",
          "type": "cva",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes {
        .cva_bwOhLd--px_s {
          padding-inline: var(--spacing-1);
      }

        .cva_bwOhLd--px_m {
          padding-inline: var(--spacing-2);
      }

        .cva_bwOhLd--px_l {
          padding-inline: var(--spacing-3);
      }

        .cva_bwOhLd--py_s {
          padding-block: var(--spacing-1);
      }

        .cva_bwOhLd--py_m {
          padding-block: var(--spacing-2);
      }

        .cva_bwOhLd--py_l {
          padding-block: var(--spacing-3);
      }
      }"
    `)
  })

  test('import map', () => {
    const code = `
    import { css } from "controlled-import-map/css";
    import { buttonStyle } from "controlled-import-map/common";
    import { stack } from "controlled-import-map/common";
    import { Box } from "controlled-import-map";

    css({ mx: '3' })
    stack({ direction: "column" })
    buttonStyle({ visual: "funky" })

    const App = () => {
      return (
        <>
          <Box color="red" />
        </>
      );
    }
     `
    const result = parseAndExtract(code, {
      outdir: 'anywhere',
      importMap: {
        css: 'controlled-import-map/css',
        recipes: 'controlled-import-map/common',
        patterns: 'controlled-import-map/common',
      },
    })

    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "mx": "3",
            },
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {
              "direction": "column",
            },
          ],
          "name": "stack",
          "type": "pattern",
        },
        {
          "data": [
            {
              "visual": "funky",
            },
          ],
          "name": "buttonStyle",
          "type": "recipe",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes {
        .buttonStyle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
      }

        .buttonStyle:is(:hover, [data-hover]) {
          background-color: var(--colors-red-200);
          font-size: var(--font-sizes-3xl);
          color: var(--colors-white);
      }

        .buttonStyle--size_md {
          padding: 0 0.75rem;
          height: 3rem;
          min-width: 3rem;
      }

        .buttonStyle--variant_solid {
          background-color: blue;
          color: var(--colors-white);
      }

        .buttonStyle--variant_solid[data-disabled] {
          background-color: gray;
          color: var(--colors-black);
          font-size: var(--font-sizes-2xl);
      }

        .buttonStyle--variant_solid:is(:hover, [data-hover]) {
          background-color: darkblue;
      }
      }

      @layer utilities {
        .mx_3 {
          margin-inline: var(--spacing-3);
      }

        .gap_8px {
          gap: 8px;
      }

        .d_flex {
          display: flex;
      }

        .flex-d_column {
          flex-direction: column;
      }
      }"
    `)
  })

  test('import map as string', () => {
    const code = `
    import { css } from "string-import-map/css";
    import { buttonStyle } from "string-import-map/recipes";
    import { stack } from "string-import-map/patterns";
    import { Box } from "string-import-map/jsx";

    css({ mx: '3' })
    stack({ direction: "column" })
    buttonStyle({ visual: "funky" })

    const App = () => {
      return (
        <>
          <Box color="red" />
        </>
      );
    }
     `
    const result = parseAndExtract(code, {
      outdir: 'anywhere',
      importMap: 'string-import-map',
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "mx": "3",
            },
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {
              "direction": "column",
            },
          ],
          "name": "stack",
          "type": "pattern",
        },
        {
          "data": [
            {
              "visual": "funky",
            },
          ],
          "name": "buttonStyle",
          "type": "recipe",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes {
        .buttonStyle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
      }

        .buttonStyle:is(:hover, [data-hover]) {
          background-color: var(--colors-red-200);
          font-size: var(--font-sizes-3xl);
          color: var(--colors-white);
      }

        .buttonStyle--size_md {
          padding: 0 0.75rem;
          height: 3rem;
          min-width: 3rem;
      }

        .buttonStyle--variant_solid {
          background-color: blue;
          color: var(--colors-white);
      }

        .buttonStyle--variant_solid[data-disabled] {
          background-color: gray;
          color: var(--colors-black);
          font-size: var(--font-sizes-2xl);
      }

        .buttonStyle--variant_solid:is(:hover, [data-hover]) {
          background-color: darkblue;
      }
      }

      @layer utilities {
        .mx_3 {
          margin-inline: var(--spacing-3);
      }

        .gap_8px {
          gap: 8px;
      }

        .d_flex {
          display: flex;
      }

        .flex-d_column {
          flex-direction: column;
      }
      }"
    `)
  })

  test('array syntax - simple', () => {
    const code = `
        import { Box } from "styled-system/jsx"

         function App() {
           return (
            <Box paddingLeft={[0]} />
          )
         }
       `

    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`[]`)

    expect(result.css).toMatchInlineSnapshot(`""`)
  })

  test('array syntax - simple conditional', () => {
    const code = `
        import { Box } from "styled-system/jsx"

         function App() {
           return (
            <Box paddingLeft={hasIcon ? [0] : [4]} />
          )
         }
       `

    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`[]`)

    expect(result.css).toMatchInlineSnapshot(`""`)
  })

  test('array syntax - conditional in middle', () => {
    const code = `
        import { Box } from "styled-system/jsx"

         function App() {
           return (
            <Box py={[2, verticallyCondensed ? 2 : 3, 4]} />
          )
         }
       `

    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`[]`)

    expect(result.css).toMatchInlineSnapshot(`""`)
  })

  test('array syntax within config recipes', () => {
    const code = `
    import { css } from "styled-system/css"
    import { card } from "styled-system/recipes"

    export default function Page() {
      return (
        <>
          <div className={cx(card(), css({ fontSize: [2, 5] }))}>Click me!</div>
        </>
      )
    }

     `
    const result = parseAndExtract(code, {
      theme: {
        extend: {
          recipes: {
            card: {
              className: 'card',
              base: {
                color: ['blue', 'red'],
              },
              variants: {
                size: {
                  sm: {
                    borderRadius: ['sm'],
                    padding: ['2'],
                    margin: '4',
                  },
                },
              },
              defaultVariants: { size: 'sm' },
            },
          },
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {},
          ],
          "name": "card",
          "type": "recipe",
        },
        {
          "data": [
            {
              "fontSize": [
                2,
                5,
              ],
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes {
        .card {
          color: blue;
      }

        .card--size_sm {
          padding: var(--spacing-2);
          margin: var(--spacing-4);
          border-radius: var(--radii-sm);
      }

        @media (width >= 40rem) {
          .card {
            color: red;
      }
      }
      }

      @layer utilities {
        .fs_2 {
          font-size: 2px;
      }

        @media (width >= 40rem) {
          .sm\\:fs_5 {
            font-size: 5px;
      }
      }
      }"
    `)
  })

  test('grid pattern minChildWidth not interpreted as token value', () => {
    const code = `
    import { grid } from 'styled-system/patterns';

    export const App = () => {
      return (
        <>
          <div className={grid({ minChildWidth: '80px', gap: 8 })} />
          <div className={grid({ minChildWidth: '20', gap: 8 })} />
        </>
      );
    };
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "gap": 8,
              "minChildWidth": "80px",
            },
          ],
          "name": "grid",
          "type": "pattern",
        },
        {
          "data": [
            {
              "gap": 8,
              "minChildWidth": "20",
            },
          ],
          "name": "grid",
          "type": "pattern",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .gap_8 {
          gap: var(--spacing-8);
      }

        .d_grid {
          display: grid;
      }

        .grid-tc_repeat\\(auto-fit\\,_minmax\\(80px\\,_1fr\\)\\) {
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
      }

        .grid-tc_repeat\\(auto-fit\\,_minmax\\(token\\(sizes\\.20\\,_20\\)\\,_1fr\\)\\) {
          grid-template-columns: repeat(auto-fit, minmax(var(--sizes-20, 20), 1fr));
      }
      }"
    `)
  })

  test('token fn in at-rules', () => {
    const code = `
    import { css } from 'styled-system/css';

    css({
      '@container (min-width: token(sizes.xl))': {
        color: 'green.300',
      },
      '@media (min-width: token(sizes.2xl))': {
        color: 'red.300',
      },
      "@container (min-width: {sizes.4xl})": {
        display: "flex"
      }
    })
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "@container (min-width: token(sizes.xl))": {
                "color": "green.300",
              },
              "@container (min-width: {sizes.4xl})": {
                "display": "flex",
              },
              "@media (min-width: token(sizes.2xl))": {
                "color": "red.300",
              },
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        @container (min-width: 36rem) {
          .\\[\\@container_\\(min-width\\:_token\\(sizes\\.xl\\)\\)\\]\\:c_green\\.300 {
            color: var(--colors-green-300);
      }
      }

        @media (min-width: 42rem) {
          .\\[\\@media_\\(min-width\\:_token\\(sizes\\.2xl\\)\\)\\]\\:c_red\\.300 {
            color: var(--colors-red-300);
      }
      }

        @container (min-width: 56rem) {
          .\\[\\@container_\\(min-width\\:_\\{sizes\\.4xl\\}\\)\\]\\:d_flex {
            display: flex;
      }
      }
      }"
    `)
  })

  test('urls as value', () => {
    const code = `
    const App = () => {
      return <CopyButton content="https://www.buymeacoffee.com/grizzlycodes" />
    }
     `
    const result = parseAndExtract(code, { strictTokens: true })
    expect(result.json).toMatchInlineSnapshot(`[]`)

    expect(result.css).toMatchInlineSnapshot('""')
  })

  test('strictTokens arbitrary value escape hatch', () => {
    const code = `
    import { css } from 'styled-system/css';

    css({
      color: '[#fff]',
      bg: 'red.300',
      bgColor: '[rgb(51 155 240)]',
      outlineColor: '[rgb(51 155 240)!]',
      borderColor: '[rgb(51 155 240)!important]',
    })
     `
    const result = parseAndExtract(code, { strictTokens: true })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "bg": "red.300",
              "bgColor": "[rgb(51 155 240)]",
              "borderColor": "[rgb(51 155 240)!important]",
              "color": "[#fff]",
              "outlineColor": "[rgb(51 155 240)!]",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .bg_red\\.300 {
          background: var(--colors-red-300);
      }

        .bd-c_\\[rgb\\(51_155_240\\)\\]\\! {
          border-color: rgb(51 155 240) !important;
      }

        .c_\\[\\#fff\\] {
          color: #fff;
      }

        .bg-c_\\[rgb\\(51_155_240\\)\\] {
          background-color: rgb(51 155 240);
      }

        .ring-c_\\[rgb\\(51_155_240\\)\\]\\! {
          outline-color: rgb(51 155 240) !important;
      }
      }"
    `)
  })

  test('extract aliased {xxx}.raw', () => {
    const code = `
    import { css } from 'styled-system/css';
    import { styled } from 'styled-system/jsx';
    import { cardStyle as aliasedCard } from 'styled-system/recipes';

    const className = aliasedCard.raw({ rounded: true })

     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "rounded": true,
            },
          ],
          "name": "cardStyle",
          "type": "recipe",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes {
        .card--rounded_true {
          border-radius: 0.375rem;
      }
      }"
    `)
  })

  test('default matchTag / matchTagProp', () => {
    const code = `
    import { Stack } from "styled-system/jsx"

    const App = () => {
      return <>
      <div color="red" />
      <Stack direction="column" />
      <Random fontSize="12px" />
      <OkComponent padding="4" content="this will be extrated" />
      </>
    }
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`[]`)

    expect(result.css).toMatchInlineSnapshot(`""`)
  })

  test('custom matchTag', () => {
    const code = `
    import { Stack } from "styled-system/jsx"

    const App = () => {
      return <>
      <div color="red" />
      <Stack direction="column" />
      <Random fontSize="12px" />
      <OkComponent padding="4" content="this will NOT be extracted" />
      </>
    }
     `
    const result = parseAndExtract(code, {
      hooks: {
        'parser:before': (args) => {
          args.configure({
            matchTag(tag) {
              return tag === 'OkComponent' ? true : false
            },
            matchTagProp(tag, prop) {
              return tag === 'OkComponent' && prop === 'content' ? false : true
            },
          })
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`[]`)

    expect(result.css).toMatchInlineSnapshot(`""`)
  })

  test('custom matchTag in extend mode preserves bamboo component matching', () => {
    const code = `
    import { Stack } from "styled-system/jsx"

    const App = () => {
      return <Stack direction="column" />
    }
     `
    const calls = new Map<string, boolean>()
    const result = parseAndExtract(code, {
      hooks: {
        'parser:before': (args) => {
          args.configure({
            matchTagMode: 'extend',
            matchTag(tag, isBambooComponent) {
              calls.set(tag, isBambooComponent)
              return false
            },
          })
        },
      },
    })

    expect(Object.fromEntries(calls)).toMatchInlineSnapshot(`
      {
        "Stack": false,
      }
    `)
    expect(result.json).toMatchInlineSnapshot(`[]`)
  })

  test('custom matchTag in override mode controls bamboo component matching', () => {
    const code = `
    import { Stack } from "styled-system/jsx"

    const App = () => {
      return <>
      <Stack direction="column" />
      <OkComponent padding="4" />
      </>
    }
     `
    const calls = new Map<string, boolean>()
    const result = parseAndExtract(code, {
      hooks: {
        'parser:before': (args) => {
          args.configure({
            matchTagMode: 'override',
            matchTag(tag, isBambooComponent) {
              calls.set(tag, isBambooComponent)
              return tag === 'OkComponent'
            },
          })
        },
      },
    })

    expect(Object.fromEntries(calls)).toMatchInlineSnapshot(`
      {
        "OkComponent": false,
        "Stack": false,
      }
    `)
    expect(result.json).toMatchInlineSnapshot(`[]`)
  })

  test('multiple css alias', () => {
    const code = `
    import { css } from '../styled-system/css'
    import { css as css2 } from '../styled-system/css'

    css({ display: 'flex' });
    css2({ flexDirection: 'column' });
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "display": "flex",
            },
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {
              "flexDirection": "column",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .d_flex {
          display: flex;
      }

        .flex-d_column {
          flex-direction: column;
      }
      }"
    `)
  })

  test('weird conditions mixing', () => {
    const code = `
    import { css } from "styled-system/css"

    const App = () => {
      return (
        <div className={css({
          _weirdCondition: {
            color: "red"
          }
        })} />
      )
     `
    const result = parseAndExtract(code, {
      conditions: {
        weirdCondition: ['@media (hover: hover) and (pointer: fine)', '&:hover', '& > div', 'span &', '& ~ &'],
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "_weirdCondition": {
                "color": "red",
              },
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        @media (hover: hover) and (pointer: fine) {
          :is(span .weirdCondition\\:c_red:hover > div) ~ :is(span .weirdCondition\\:c_red:hover > div) {
            color: red;
      }
      }
      }"
    `)
  })

  test('colorPalette with DEFAULT', () => {
    const code = `
    import { css } from "styled-system/css"
    css({
      colorPalette: 'bg.primary',
      backgroundColor: 'colorPalette'
    })
     `
    const result = parseAndExtract(code, {
      theme: {
        extend: {
          semanticTokens: {
            colors: {
              bg: {
                primary: {
                  DEFAULT: {
                    value: '{colors.yellow.500}',
                  },
                  base: {
                    value: '{colors.yellow.500}',
                  },
                  hover: {
                    value: '{colors.yellow.300}',
                  },
                },
              },
            },
          },
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "backgroundColor": "colorPalette",
              "colorPalette": "bg.primary",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .color-palette_bg\\.primary {
          --colors-color-palette: var(--colors-bg-primary);
          --colors-color-palette-base: var(--colors-bg-primary-base);
          --colors-color-palette-hover: var(--colors-bg-primary-hover);
      }

        .bg-c_colorPalette {
          background-color: var(--colors-color-palette);
      }
      }"
    `)
  })

  test('tokens starting with 0', () => {
    const code = `
    import { css } from "styled-system/css"

    css({ margin: "025" })
     `
    const result = parseAndExtract(code, {
      theme: {
        tokens: {
          spacing: {
            '025': {
              value: '0.125rem',
            },
          },
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "margin": "025",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .m_025 {
          margin: var(--spacing-025);
      }
      }"
    `)
  })

  test('assets', () => {
    const code = `
    import { css } from "styled-system/css"

    css({ backgroundImage: "checkbox" })
     `
    const result = parseAndExtract(code, {
      theme: {
        tokens: {
          assets: {
            checkbox: {
              value: {
                type: 'svg',
                value: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16"><path stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h8"/></svg>`,
              },
            },
          },
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "backgroundImage": "checkbox",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .bg-i_checkbox {
          background-image: var(--assets-checkbox);
      }
      }"
    `)
  })

  test('flat and nested object on same key', () => {
    const code = `
    const className = css({
      color: "black",
      backgroundColor: "black.10",
      borderColor: "black.20"
    })
     `
    const result = parseAndExtract(code, {
      presets: [
        {
          name: 'preset',
          theme: {
            extend: {
              tokens: {
                colors: {
                  black: { value: 'black' },
                },
              },
            },
          },
        },
      ],
      theme: {
        extend: {
          tokens: {
            colors: {
              black: {
                0: { value: 'black' },
                10: { value: 'black/10' },
                20: { value: 'black/20' },
                30: { value: 'black/30' },
              },
            },
          },
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "backgroundColor": "black.10",
              "borderColor": "black.20",
              "color": "black",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .bd-c_black\\.20 {
          border-color: var(--colors-black-20);
      }

        .c_black {
          color: var(--colors-black);
      }

        .bg-c_black\\.10 {
          background-color: var(--colors-black-10);
      }
      }"
    `)
  })

  test('slot recipes with textStyles', () => {
    const code = `
    import { cta } from 'styled-system/recipes';
    import { css } from 'styled-system/css';

    const Cta = ({ level, text, title }) => {
      const cn = cta({ level });

      return (
        <div className={cn.wrapper}>
          <p className={cn.heading}>{title}</p>
          <p className={cn.text}>{text}</p>
        </div>
      );
    };

    const App = () => {
      return (
        <>
        <div className="case">
          <p>
            The following paragraph should not have any bottom margin nor color
            applied as it uses the <code>heading-1</code> <code>textStyle</code>:
          </p>
          <p
            className={css({ textStyle: 'heading-1' })}
          >
            P with textStyle
          </p>
          <p>Text</p>
        </div>
        <div className="case">
          <p>
            The following paragraph should have a bottom margin and color applied
            as it uses the <code>cta</code> recipe:
          </p>
          <Cta text="Text" title="P in recipe heading" level="1" />
        </div>
        </>)
    }
     `
    const result = parseAndExtract(code, {
      eject: true,
      theme: {
        breakpoints: { sm: '480px' },
        slotRecipes: {
          cta: {
            className: 'cta',
            slots: ['heading', 'text', 'wrapper'],
            base: {},
            variants: {
              level: {
                1: {
                  heading: {
                    textStyle: 'heading-1',
                    color: { base: 'green', sm: 'red' },
                    marginBottom: { base: '20px', sm: '40px' },
                  },
                },
              },
            },
          },
        },
        textStyles: {
          'heading-1': {
            description: 'Heading 1',
            value: {
              fontWeight: 'bold',
              fontSize: { base: '2px', sm: '40px' },
              textTransform: 'uppercase',
            },
          },
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {},
          ],
          "name": "cta",
          "type": "recipe",
        },
        {
          "data": [
            {
              "textStyle": "heading-1",
            },
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {
              "level": "1",
            },
          ],
          "name": "Cta",
          "type": "jsx-recipe",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes.slots {
        .cta__heading--level_1 {
          font-weight: bold;
          font-size: 2px;
          text-transform: uppercase;
          color: green;
          margin-bottom: 20px;
      }

        @media (width >= 30rem) {
          .cta__heading--level_1 {
            font-size: 40px;
            color: red;
            margin-bottom: 40px;
      }
      }
      }

      @layer utilities {
        @layer compositions {
          .textStyle_heading-1 {
            font-weight: bold;
            font-size: 2px;
            text-transform: uppercase;
      }

          @media (width >= 30rem) {
            .textStyle_heading-1 {
              font-size: 40px;
      }
      }
      }
      }"
    `)
  })

  test('config.outdir detection with baseUrl', () => {
    const code = `
    import { css } from "styled-system/css";

    export const Markdown = () => {
      return (
        <ReactMarkdown
          components={{
            blockquote: ({ ref, node, ...props }) => (
              <blockquote
                className={css({
                  borderLeftWidth: "4px",
                  borderLeftStyle: "solid",
                  borderLeftColor: "border.default",
                  padding: 4,
                })}
                {...props}
              />
            ),
            ul: ({ ref, node, ...props }) => (
              <ul className={css({ pl: "4", listStyleType: "disc" })} {...props} />
            ),
            ol: ({ ref, node, ...props }) => (
              <ol className={css({ pl: "4", listStyleType: "decimal" })} {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      );
    };

     `
    const result = parseAndExtract(
      code,
      {
        outdir: './styled-system',
      },
      {
        compilerOptions: {
          baseUrl: '.',
        },
      },
    )
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "borderLeftColor": "border.default",
              "borderLeftStyle": "solid",
              "borderLeftWidth": "4px",
              "padding": 4,
            },
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {
              "listStyleType": "disc",
              "pl": "4",
            },
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {
              "listStyleType": "decimal",
              "pl": "4",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .p_4 {
          padding: var(--spacing-4);
      }

        .li-t_disc {
          list-style-type: disc;
      }

        .li-t_decimal {
          list-style-type: decimal;
      }

        .bd-l-w_4px {
          border-left-width: 4px;
      }

        .border-left-style_solid {
          border-left-style: solid;
      }

        .bd-l-c_border\\.default {
          border-left-color: border.default;
      }

        .pl_4 {
          padding-left: var(--spacing-4);
      }
      }"
    `)
  })

  test('config.outdir detection in nested folder with baseUrl', () => {
    const code = `
    import { css } from "styled-system/css";

    export const Markdown = () => {
      return (
        <ReactMarkdown
          components={{
            blockquote: ({ ref, node, ...props }) => (
              <blockquote
                className={css({
                  borderLeftWidth: "4px",
                  borderLeftStyle: "solid",
                  borderLeftColor: "border.default",
                  padding: 4,
                })}
                {...props}
              />
            ),
            ul: ({ ref, node, ...props }) => (
              <ul className={css({ pl: "4", listStyleType: "disc" })} {...props} />
            ),
            ol: ({ ref, node, ...props }) => (
              <ol className={css({ pl: "4", listStyleType: "decimal" })} {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      );
    };

     `
    const result = parseAndExtract(
      code,
      {
        outdir: './src/styled-system',
      },
      {
        compilerOptions: {
          baseUrl: './src',
        },
      },
    )
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "borderLeftColor": "border.default",
              "borderLeftStyle": "solid",
              "borderLeftWidth": "4px",
              "padding": 4,
            },
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {
              "listStyleType": "disc",
              "pl": "4",
            },
          ],
          "name": "css",
          "type": "css",
        },
        {
          "data": [
            {
              "listStyleType": "decimal",
              "pl": "4",
            },
          ],
          "name": "css",
          "type": "css",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .p_4 {
          padding: var(--spacing-4);
      }

        .li-t_disc {
          list-style-type: disc;
      }

        .li-t_decimal {
          list-style-type: decimal;
      }

        .bd-l-w_4px {
          border-left-width: 4px;
      }

        .border-left-style_solid {
          border-left-style: solid;
      }

        .bd-l-c_border\\.default {
          border-left-color: border.default;
      }

        .pl_4 {
          padding-left: var(--spacing-4);
      }
      }"
    `)
  })

  test('recipes default className based on key', () => {
    const code = `
    import { testRecipe } from "styled-system/recipes";

   export const App = () => {
     return <div className={testRecipe()} />
   }

     `
    const result = parseAndExtract(code, {
      theme: {
        extend: {
          recipes: {
            testRecipe: {
              base: {
                display: 'flex',
              },
            },
          },
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {},
          ],
          "name": "testRecipe",
          "type": "recipe",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes {
        .testRecipe {
          display: flex;
      }
      }"
    `)
  })

  test('slotRecipes default className based on key', () => {
    const code = `
    import { testSlotRecipe } from "styled-system/recipes";

   export const App = () => {
     return <div className={testSlotRecipe()} />
   }

     `
    const result = parseAndExtract(code, {
      theme: {
        extend: {
          slotRecipes: {
            testSlotRecipe: {
              slots: ['root'],
              base: {
                root: {
                  display: 'flex',
                },
              },
            },
          },
        },
      },
    })
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {},
          ],
          "name": "testSlotRecipe",
          "type": "recipe",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes.slots {
        .testSlotRecipe__root {
          display: flex;
      }
      }"
    `)
  })
})
