import { css, cx } from '../../styled-system/css'
import { hstack, stack } from '../../styled-system/patterns'

/**
 * A tree covering both halves of the fold: shapes that collapse to an intrinsic tag,
 * and shapes that must keep their runtime path. Rendering it with and without the
 * transform is what proves the rewrite is behaviour-preserving at the markup level,
 * which the class-string assertions elsewhere cannot show.
 */
export const Tree = ({ tone, rest, flag }: { tone: string; rest: Record<string, unknown>; flag: boolean }) => (
  <div className={css({ padding: 'md', backgroundColor: 'gray100' })}>
    {/* folds: a static call resolves to a class literal */}
    <span className={css({ color: 'blue600', fontWeight: 'bold' })}>plain</span>

    {/* folds: non-style props are untouched beside it */}
    <button
      className={css({ color: 'white', backgroundColor: 'blue600' })}
      id="cta"
      data-testid="cta"
      aria-label="Call to action"
    >
      passthrough
    </button>

    {/* folds: a static className is joined where cx would put it */}
    <p className={cx(css({ color: 'gray800' }), 'prose')}>classname</p>

    {/* folds: conditions and nested values */}
    <div className={css({ color: 'gray800', _hover: { color: 'red600' }, fontSize: { base: 'body', md: 'h4' } })}>
      conditions
    </div>

    {/* folds: boolean and numeric values */}
    <div className={css({ zIndex: 10, padding: 'xs' })}>scalars</div>

    {/* folds: nested elements, both levels */}
    <div className={css({ padding: 'xs' })}>
      <span className={css({ color: 'red600' })}>nested</span>
    </div>

    {/* declines: a condition object is one class per condition, which no prefix describes */}
    <div className={css({ padding: { base: 'sm', md: tone } })}>dynamic</div>

    {/* partially folds: the static half becomes a literal, the dynamic one is lowered */}
    <div className={css({ padding: 'xs', fontWeight: 'bold', backgroundColor: tone })}>partial call</div>

    {/* the shape a scalar-only fixture cannot reach: the dynamic leaf is *inside* the
        nested values, not beside them. Folding used to resolve the static leaves and drop
        the rest, which renders missing half its rules. */}
    <div
      className={css({
        color: 'blue600',
        _hover: { color: tone },
        fontSize: { base: 'body', md: tone },
        padding: 'xs',
      })}
    >
      partial with a dynamic leaf
    </div>

    {/* declines: a spread leaves the build unable to say which properties the call sets */}
    <div className={css({ color: 'green600', ...rest })} title="spread title">
      spread
    </div>

    {/* folds: the tag is written out, so any element can carry the class */}
    <section className={css({ color: 'yellow600' })}>as</section>

    {/* folds: a pattern call site resolves to its class string */}
    <div className={stack({ gap: 'sm' })}>
      <div className={css({ padding: 'xs', backgroundColor: 'white' })} id="boxed">
        box
      </div>
      <div className={hstack({ gap: 'xxs', color: 'gray700' })}>hstack</div>
    </div>

    {/* folds: the tag is written out, so any element can carry a pattern class */}
    <nav className={stack({ gap: 'xxs' })}>nav stack</nav>

    {/* declines: a dynamic pattern prop */}
    <div className={stack({ gap: tone })}>dynamic pattern</div>

    {/* folds as a call site, not an element */}
    <div className={css({ color: 'blue800', padding: 'xs' })}>call site</div>

    {/* partially folds: the static half becomes a literal, the dynamic half stays */}
    <div className={css({ color: 'blue600', padding: 'xs', backgroundColor: tone })}>partial</div>

    <div className={css({ color: tone })}>dynamic call site</div>

    {/* lowers: both branches resolve, so the choice is between two class literals */}
    <div className={css({ padding: 'xs', color: flag ? 'red600' : 'green600' })}>finite branch</div>

    {/* lowers to a ternary alone, leaving no call behind */}
    <div className={css({ color: flag ? 'blue800' : 'gray700' })}>lone branch</div>

    {/* declines the lowering: two ternaries would emit a class for one property */}
    <div className={css({ padding: 'xs', mx: flag ? 'xs' : 'sm', marginInline: flag ? 'md' : 'xxs' })}>
      colliding branches
    </div>
  </div>
)
