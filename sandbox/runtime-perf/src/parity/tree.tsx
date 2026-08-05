import { css } from '../../styled-system/css'
import { Box, HStack, Stack, styled } from '../../styled-system/jsx'

/**
 * A tree covering both halves of the fold: shapes that collapse to an intrinsic tag,
 * and shapes that must keep their runtime path. Rendering it with and without the
 * transform is what proves the rewrite is behaviour-preserving at the markup level,
 * which the class-string assertions elsewhere cannot show.
 */
export const Tree = ({ tone, rest, flag }: { tone: string; rest: Record<string, unknown>; flag: boolean }) => (
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

    {/* declines: a responsive array is one class per breakpoint, which no prefix describes */}
    <styled.div padding={['sm', tone]}>dynamic</styled.div>

    {/* partially folds: static props become a literal, the dynamic one goes to css() */}
    <styled.div padding="xs" fontWeight="bold" backgroundColor={tone}>
      partial element
    </styled.div>

    {/* the shape a scalar-only fixture cannot reach: the dynamic leaf is *inside* the
        nested values, not beside them. Folding used to resolve the static leaves and drop
        the rest, which renders as a styled element missing half its rules. */}
    <styled.div color="blue600" _hover={{ color: tone }} fontSize={{ base: 'body', md: tone }} padding="xs">
      partial with a dynamic leaf
    </styled.div>

    {/* declines: spread */}
    <styled.div color="green600" {...rest}>
      spread
    </styled.div>

    {/* folds: a static as prop names the tag */}
    <styled.div as="section" color="yellow600">
      as
    </styled.div>

    {/* declines: css prop */}
    <styled.div css={{ color: 'gray600' }}>css prop</styled.div>

    {/* folds: pattern elements collapse the pattern and the factory together */}
    <Stack gap="sm">
      <Box padding="xs" backgroundColor="white" id="boxed">
        box
      </Box>
      <HStack gap="xxs" color="gray700">
        hstack
      </HStack>
    </Stack>

    {/* folds: a pattern with a static as prop */}
    <Stack gap="xxs" as="nav">
      nav stack
    </Stack>

    {/* declines: a dynamic pattern prop */}
    <Stack gap={tone}>dynamic pattern</Stack>

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
  </styled.div>
)
