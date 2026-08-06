import { css } from '../../styled-system/css'

/**
 * Call sites whose style values are known only at runtime.
 *
 * `tree.tsx` is dominated by shapes that fold away entirely and carries a single dynamic
 * value, so it measures what folding is worth where most of the work disappears. This
 * measures the other half: calls that keep a runtime path either way, where the only
 * question is what that path costs.
 *
 * Every value here is a scalar the fold can lower to a class prefix plus its value. The
 * shapes that cannot lower — responsive arrays, condition blocks — are in `tree.tsx`, and
 * folding leaves them exactly as they were.
 */
const shell = css({ borderRadius: 'sm' })
export const Dynamic = ({ tone, size, gap }: { tone: string; size: string; gap: string }) => (
  <div className={`${css({ padding: 'md', backgroundColor: tone })} ${shell}`}>
    <span className={css({ color: tone, fontWeight: 'bold' })}>one</span>

    <p className={css({ color: tone, fontSize: size })}>two</p>

    <div className={css({ color: 'gray800', backgroundColor: tone, margin: gap })}>three</div>

    <button className={css({ color: tone, backgroundColor: 'blue600' })} id="cta">
      four
    </button>

    <span className={css({ color: tone, margin: gap, fontSize: size })}>five</span>
  </div>
)
