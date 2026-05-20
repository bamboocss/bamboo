import { describe, expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { styled } from '../../styled-system-format-names/jsx'
import { buttonWithCompoundVariants } from '../../styled-system-format-names/recipes'
import React from 'react'

describe('styled factory - cva', () => {
  const Button = styled('button', {
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
    const { container } = render(<Button>Click me</Button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="c-$red-500 bg-$blue-500 hover:c-$red-600 hover:bg-$blue-600"
      >
        Click me
      </button>
    `)
  })

  test('variant styles', () => {
    const { container } = render(<Button size="sm">Click me</Button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="c-$red-500 bg-$blue-500 hover:c-$red-600 hover:bg-$blue-600 fs-$sm px-$sm py-$xs"
      >
        Click me
      </button>
    `)
  })

  test('custom className', () => {
    const { container } = render(
      <Button className="custom-btn" size="sm">
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="c-$red-500 bg-$blue-500 hover:c-$red-600 hover:bg-$blue-600 fs-$sm px-$sm py-$xs custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('style prop', () => {
    const { container } = render(
      <Button className="custom-btn" mx="2">
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="c-$red-500 bg-$blue-500 hover:c-$red-600 hover:bg-$blue-600 custom-btn"
        mx="2"
      >
        Click me
      </button>
    `)
  })

  test('style prop with variant', () => {
    const { container } = render(
      <Button className="custom-btn" size="sm" mx="2">
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="c-$red-500 bg-$blue-500 hover:c-$red-600 hover:bg-$blue-600 fs-$sm px-$sm py-$xs custom-btn"
        mx="2"
      >
        Click me
      </button>
    `)
  })

  test('css prop', () => {
    const { container } = render(
      <Button className="custom-btn" css={{ color: '$red-100', fontSize: '$md' }}>
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="c-$red-500 bg-$blue-500 hover:c-$red-600 hover:bg-$blue-600 custom-btn"
        css="[object Object]"
      >
        Click me
      </button>
    `)
  })

  test('css prop with variant', () => {
    const { container } = render(
      <Button className="custom-btn" size="sm" css={{ color: '$red-100', fontSize: '$md' }}>
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="c-$red-500 bg-$blue-500 hover:c-$red-600 hover:bg-$blue-600 fs-$sm px-$sm py-$xs custom-btn"
        css="[object Object]"
      >
        Click me
      </button>
    `)
  })

  test('all together', () => {
    const { container } = render(
      <Button className="custom-btn" css={{ color: '$red-200', fontSize: '$xl' }} size="lg" mx="$2">
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="c-$red-500 bg-$blue-500 hover:c-$red-600 hover:bg-$blue-600 fs-$lg px-123px py-$md z-1 custom-btn"
        css="[object Object]"
        mx="$2"
      >
        Click me
      </button>
    `)
  })
})

describe('styled factory - button recipe', () => {
  const Button = styled('button', buttonWithCompoundVariants)

  test('base styles', () => {
    const { container } = render(<Button>Click me</Button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled"
      >
        Click me
      </button>
    `)
  })

  test('variant styles', () => {
    const { container } = render(<Button size="sm">Click me</Button>)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled button--size-sm"
      >
        Click me
      </button>
    `)
  })

  test('custom className', () => {
    const { container } = render(
      <Button className="custom-btn" size="sm">
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled button--size-sm custom-btn"
      >
        Click me
      </button>
    `)
  })

  test('style prop', () => {
    const { container } = render(
      <Button className="custom-btn" mx="2">
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled custom-btn"
        mx="2"
      >
        Click me
      </button>
    `)
  })

  test('style prop with variant', () => {
    const { container } = render(
      <Button className="custom-btn" size="sm" mx="2">
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled button--size-sm custom-btn"
        mx="2"
      >
        Click me
      </button>
    `)
  })

  test('css prop', () => {
    const { container } = render(
      <Button className="custom-btn" css={{ color: '$red-100', fontSize: '$md' }}>
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled custom-btn"
        css="[object Object]"
      >
        Click me
      </button>
    `)
  })

  test('css prop with variant', () => {
    const { container } = render(
      <Button className="custom-btn" size="sm" css={{ color: '$red-100', fontSize: '$md' }}>
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-unstyled button--size-sm custom-btn"
        css="[object Object]"
      >
        Click me
      </button>
    `)
  })

  test('all together', () => {
    const { container } = render(
      <Button className="custom-btn" css={{ color: '$red-200', fontSize: '$xl' }} size="md" visual="outline" mx="-$2">
        Click me
      </Button>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="button button--visual-outline button--size-md c-green custom-btn"
        css="[object Object]"
        mx="-$2"
      >
        Click me
      </button>
    `)
  })

  test('html props', () => {
    const { container } = render(
      <styled.div htmlWidth={123} height="123">
        Click me
      </styled.div>,
    )

    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="h-123"
        width="123"
      >
        Click me
      </div>
    `)
  })
})
