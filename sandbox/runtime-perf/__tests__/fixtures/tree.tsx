import { css } from '../../styled-system/css'
import { styled } from '../../styled-system/jsx'

/**
 * A tree covering both halves of the fold: shapes that collapse to an intrinsic tag,
 * and shapes that must keep their runtime path. Rendering it with and without the
 * transform is what proves the rewrite is behaviour-preserving at the markup level,
 * which the class-string assertions elsewhere cannot show.
 */
export const Tree = ({ tone, rest }: { tone: string; rest: Record<string, unknown> }) => (
  <styled.div padding="md" backgroundColor="gray100">
    {/* folds: style props only */}
    <styled.span color="blue600" fontWeight="bold">
      plain
    </styled.span>

    {/* folds: non-style props pass through to the DOM */}
    <styled.button color="white" backgroundColor="blue600" id="cta" data-testid="cta" aria-label="Call to action">
      passthrough
    </styled.button>

    {/* folds: static className is appended where cx would put it */}
    <styled.p color="gray800" className="prose">
      classname
    </styled.p>

    {/* folds: conditions and nested values */}
    <styled.div color="gray800" _hover={{ color: 'red600' }} fontSize={{ base: 'body', md: 'h4' }}>
      conditions
    </styled.div>

    {/* folds: boolean and numeric props */}
    <styled.div zIndex={10} padding="xs">
      scalars
    </styled.div>

    {/* folds: nested elements, both levels */}
    <styled.div padding="xs">
      <styled.span color="red600">nested</styled.span>
    </styled.div>

    {/* declines: dynamic style prop */}
    <styled.div color={tone}>dynamic</styled.div>

    {/* declines: spread */}
    <styled.div color="green600" {...rest}>
      spread
    </styled.div>

    {/* declines: as prop */}
    <styled.div as="section" color="yellow600">
      as
    </styled.div>

    {/* declines: css prop */}
    <styled.div css={{ color: 'gray600' }}>css prop</styled.div>

    {/* folds as a call site, not an element */}
    <div className={css({ color: 'blue800', padding: 'xs' })}>call site</div>

    {/* declines as a call site: runtime value */}
    <div className={css({ color: tone })}>dynamic call site</div>
  </styled.div>
)
