import { useState } from 'react'
import { css, cx } from '../styled-system/css'
import { center as centerLike, flex } from '../styled-system/patterns'
import { button, someRecipe } from '../styled-system/recipes'
import { Badge, badge } from './Badge'
import { AnotherButtonWithRegex, Button, ListedButton } from './Button'
import { Card } from './Card'

/** A shared style object, spread into calls below — the shape the fold now accounts for. */
const surface = { borderWidth: '1px', borderRadius: 'md' }

function App() {
  const paddingY = '22px'
  const className = css({ padding: paddingY, fontSize: paddingY ? '2xl' : '4xl' })
  const panel = css({ padding: '5', ...surface })

  // Runtime choice between compiled classes, rather than a runtime *value* inside one.
  // `css({ color })` cannot compile — the class it would return depends on state the build
  // cannot see — while picking between two calls that each compiled is exactly what the
  // emitted class strings are for.
  const [emphasized] = useState(true)
  const headingColor = emphasized ? css({ color: 'lime.300' }) : css({ color: 'gray.500' })

  return (
    <div className={flex({ direction: 'column', gap: '8px', padding: '40px', align: 'stretch', color: 'red.300' })}>
      <section className={panel}>
        <p className={css({ fontWeight: 'semibold', mb: '2' })}>CSS - Function</p>
        <div className={css({ maxWidth: '840px', marginX: 'auto', textAlign: 'center' })}>
          <div>
            <h1 className={cx(css({ fontSize: '56px', lineHeight: '1.1em' }), headingColor)}>
              Create accessible React apps <span className={css({ color: 'teal' })}>with speed</span>
            </h1>
            <p className={css({ color: 'text', fontSize: '20px', marginTop: '40px' })}>
              Chakra UI is a simple, modular and accessible component library that gives you the building blocks you
              need to build your React applications.
            </p>

            <div className={css({ marginTop: '40px', display: 'inline-flex', gap: '4' })}>
              <button
                className={css({
                  height: '40px',
                  background: 'red.200',
                  color: 'red.500',
                  borderRadius: '8px',
                  paddingX: '24px',
                  translate: { _active: '0 3px' },
                })}
              >
                Get Started
              </button>

              <button
                className={css({
                  height: '40px',
                  background: 'gray.200',
                  borderRadius: '8px',
                  paddingX: '24px',
                })}
              >
                Github
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={css({ padding: '5', borderWidth: '1px' })}>
        <p className={css({ fontWeight: 'semibold', mb: '2' })}>Recipe - JSX</p>
        <Button aria-label="Hello World" variant="danger" size="md">
          Hello
        </Button>
        <ListedButton aria-label="Listed" variant="primary" size="md">
          Listed
        </ListedButton>
        <AnotherButtonWithRegex aria-label="AnotherButtonWithRegex" variant="secondary" size="sm">
          AnotherButtonWithRegex
        </AnotherButtonWithRegex>
        <span className={button({ variant: 'purple' })}>Default variant at the call site</span>
      </section>

      <section className={css({ padding: '5', borderWidth: '1px' })}>
        <p className={css({ fontWeight: 'semibold', mb: '2' })}>CVA - JSX</p>
        <Card size="sm" shape="square" className={css({ width: '400px' })}>
          size:sm + open:true
        </Card>
        <Card shape="circle" open>
          size:xs + open:true + shape:square
        </Card>
        <Badge status="success" className={css({ background: 'pink.800' })}>
          Welcome
        </Badge>
      </section>

      <section className={css({ padding: '5', borderWidth: '1px' })}>
        <p className={css({ fontWeight: 'semibold', mb: '2' })}>Pattern - Function (nested)</p>
        <div
          className={flex({
            direction: 'column',
            align: 'center',
            padding: '20px',
            marginBottom: '30px',
            bg: 'green.100',
            gap: { base: '4', md: '10' },
          })}
        >
          <div
            className={centerLike({
              size: '40px',
              borderRadius: 'full',
              bg: 'red.300',
              fontSize: '1.2em',
              fontWeight: 'bold',
            })}
          >
            S
          </div>
          <div className={flex({ align: 'center', gap: '40px', debug: true })}>
            <div className={className}>Element 1</div>
            <div className={css({ color: 'red', fontWeight: 'bold', fontSize: '50px' })}>Element 2</div>
          </div>
        </div>
      </section>

      <section className={css({ padding: '5', borderWidth: '1px' })}>
        <p className={css({ fontWeight: 'semibold', mb: '2' })}>Pattern - Function</p>
        <div
          className={flex({
            direction: 'column',
            align: 'center',
            gap: '8px',
            justify: 'center',
            bg: 'red.200',
            py: '2',
            mb: '30px',
            debug: true,
          })}
        >
          <button className={cx(button({ variant: 'primary', state: 'focused' }), css({ color: 'yellow' }))}>
            Click me
          </button>
          <button>Button 1</button>
          <button>Button 2</button>
          <div className={centerLike({ size: '10', borderRadius: 'full', bg: 'purple', color: 'white' })}>3</div>
        </div>
      </section>

      <section className={flex({ direction: 'column', gap: '8px', padding: '5', borderWidth: '1px' })}>
        <p className={css({ fontWeight: 'semibold', mb: '2' })}>CVA - Function</p>
        <div className={badge({ status: 'warning' })}>Warning</div>
        <div className={badge({ status: 'success' })}>Warning</div>
      </section>

      <div className={cx(someRecipe({ size: 'small' }), css({ color: 'red.400' }))}>
        config recipe compoundVariants overriding at the call site, should be red.100
      </div>
      <span
        className={css({
          height: '5',
          width: '5',
          animation: 'spin 1s linear infinite',
        })}
      >
        spinning
      </span>
    </div>
  )
}

export default App
