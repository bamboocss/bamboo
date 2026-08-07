import { describe, expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { css, cva, cx } from '../../styled-system-format-names/css'
import { buttonWithCompoundVariants } from '../../styled-system-format-names/recipes'
import React from 'react'

describe('cva', () => {
  const button = cva({
    base: {
      color: '$red-500',
      bg: '$blue-500',
      _hover: {
        color: '$red-600',
        bg: '$blue-600',
      },
    },
    variants: {
      size: {
        sm: {
          fontSize: '$sm',
          px: '$sm',
          py: '$xs',
        },
        md: {
          fontSize: '$md',
          px: '$md',
          py: '$sm',
        },
        lg: {
          fontSize: '$lg',
          px: '$lg',
          py: '$md',
        },
      },
    },
    compoundVariants: [
      {
        size: 'lg',
        css: { px: '123px', zIndex: 1 },
      },
    ],
  })

  test('base styles', () => {
    const { container } = render(<button className={button()}>Click me</button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="cva_iZfUVA"
      >
        Click me
      </button>
    `)
  })

  test('variant styles', () => {
    const { container } = render(<button className={button({ size: 'sm' })}>Click me</button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="cva_iZfUVA cva_iZfUVA--size-sm"
      >
        Click me
      </button>
    `)
  })

  test('custom className', () => {
    const { container } = render(<button className={cx(button({ size: 'sm' }), 'custom-btn')}>Click me</button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="cva_iZfUVA cva_iZfUVA--size-sm custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('style prop', () => {
    const { container } = render(<button className={cx(button(), css({ mx: '2' }), 'custom-btn')}>Click me</button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="cva_iZfUVA mx-2 custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('style prop with variant', () => {
    const { container } = render(
      <button className={cx(button({ size: 'sm' }), css({ mx: '2' }), 'custom-btn')}>Click me</button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="cva_iZfUVA cva_iZfUVA--size-sm mx-2 custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('css prop', () => {
    const { container } = render(
      <button className={cx(button(), css({ color: '$red-100', fontSize: '$md' }), 'custom-btn')}>Click me</button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="cva_iZfUVA c-$red-100 fs-$md custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('css prop with variant', () => {
    const { container } = render(
      <button className={cx(button({ size: 'sm' }), css({ color: '$red-100', fontSize: '$md' }), 'custom-btn')}>
        Click me
      </button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="cva_iZfUVA cva_iZfUVA--size-sm c-$red-100 fs-$md custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('all together', () => {
    const { container } = render(
      <button
        className={cx(button({ size: 'lg' }), css({ mx: '$2', color: '$red-200', fontSize: '$xl' }), 'custom-btn')}
      >
        Click me
      </button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="cva_iZfUVA cva_iZfUVA--size-lg mx-$2 c-$red-200 fs-$xl custom-btn"
      >
        Click me
      </button>
    `)
  })
})

describe('button recipe', () => {
  const button = buttonWithCompoundVariants

  test('base styles', () => {
    const { container } = render(<button className={button()}>Click me</button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled"
      >
        Click me
      </button>
    `)
  })

  test('variant styles', () => {
    const { container } = render(<button className={button({ size: 'sm' })}>Click me</button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled button--size-sm"
      >
        Click me
      </button>
    `)
  })

  test('custom className', () => {
    const { container } = render(<button className={cx(button({ size: 'sm' }), 'custom-btn')}>Click me</button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled button--size-sm custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('style prop', () => {
    const { container } = render(<button className={cx(button(), css({ mx: '2' }), 'custom-btn')}>Click me</button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled mx-2 custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('style prop with variant', () => {
    const { container } = render(
      <button className={cx(button({ size: 'sm' }), css({ mx: '2' }), 'custom-btn')}>Click me</button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled button--size-sm mx-2 custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('css prop', () => {
    const { container } = render(
      <button className={cx(button(), css({ color: '$red-100', fontSize: '$md' }), 'custom-btn')}>Click me</button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled c-$red-100 fs-$md custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('css prop with variant', () => {
    const { container } = render(
      <button className={cx(button({ size: 'sm' }), css({ color: '$red-100', fontSize: '$md' }), 'custom-btn')}>
        Click me
      </button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled button--size-sm c-$red-100 fs-$md custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('all together', () => {
    const { container } = render(
      <button
        className={cx(
          button({ size: 'md', visual: 'outline' }),
          css({ mx: '-$2', color: '$red-200', fontSize: '$xl' }),
          'custom-btn',
        )}
      >
        Click me
      </button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-outline button--size-md mx--$2 c-$red-200 fs-$xl custom-btn"
      >
        Click me
      </button>
    `)
  })
})
