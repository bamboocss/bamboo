import { GlobalPositionTry } from '../src/global-position-try'

describe('global position try', () => {
  test('dash ident', () => {
    const pos = new GlobalPositionTry({
      globalPositionTry: {
        '--bottom-scrollable': {
          alignSelf: 'stretch',
        },
      },
    })

    expect(pos.toString()).toMatchInlineSnapshot(`
      "@position-try --bottom-scrollable {
        align-self: stretch;

      }"
    `)
  })

  test('without dash ident', () => {
    const pos = new GlobalPositionTry({
      globalPositionTry: {
        'bottom-scrollable': {
          positionArea: 'block-start span-inline-end',
          alignSelf: 'stretch',
        },
      },
    })

    expect(pos.toString()).toMatchInlineSnapshot(`
      "@position-try --bottom-scrollable {
        position-area: block-start span-inline-end;
      align-self: stretch;

      }"
    `)
  })

  /**
   * `names` is what gets registered as values `positionTryFallbacks` accepts, so it has to say
   * what the stylesheet declares rather than what the config was keyed by. A raw `flip` would
   * autocomplete a name no rule matches — `position-try-fallbacks: flip` is invalid css.
   */
  test('names are the idents the rules actually declare', () => {
    const pos = new GlobalPositionTry({
      globalPositionTry: { flip: { top: 'auto' }, '--slide': { left: 'auto' } },
    })

    expect(pos.names).toEqual(['--flip', '--slide'])
  })
})
