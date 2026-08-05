import { css } from '../../styled-system/css'
import { styled } from '../../styled-system/jsx'

/**
 * Elements whose style props are known only at runtime.
 *
 * `tree.tsx` is dominated by shapes that fold away entirely and carries a single dynamic
 * style prop, so it measures what folding is worth against a factory that mostly did not
 * need to run. This measures the other half: elements that keep a runtime path either
 * way, where the only question is what that path costs.
 *
 * Every prop here is a scalar the fold can lower to a class prefix plus its value. The
 * shapes that cannot lower — responsive arrays, condition blocks — are in `tree.tsx`, and
 * folding leaves them exactly as they were.
 *
 * `css` is imported because element splitting needs it in scope: the fold attaches its
 * bindings to an existing bamboo import rather than inventing a module specifier, so a
 * file that only imports `styled` is left alone. Used once at module scope, where it
 * costs nothing per render on either side.
 */
const shell = css({ borderRadius: 'sm' })
export const Dynamic = ({ tone, size, gap }: { tone: string; size: string; gap: string }) => (
  <styled.div padding="md" backgroundColor={tone} className={shell}>
    <styled.span color={tone} fontWeight="bold">
      one
    </styled.span>

    <styled.p color={tone} fontSize={size}>
      two
    </styled.p>

    <styled.div color="gray800" backgroundColor={tone} margin={gap}>
      three
    </styled.div>

    <styled.button color={tone} backgroundColor="blue600" id="cta">
      four
    </styled.button>

    <styled.span color={tone} margin={gap} fontSize={size}>
      five
    </styled.span>
  </styled.div>
)
