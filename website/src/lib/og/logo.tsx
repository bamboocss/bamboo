import { CSSProperties } from 'react'

const BADGE = '#000000'
const MARK = '#F6E458'

/**
 * The Open Graph lockup: the bamboo mark badged in black, beside the wordmark.
 *
 * Two things differ from `theme/icons.tsx`, and both are forced by where this renders.
 *
 * The badge is black with a yellow stalk, inverting the header lockup. The card's own
 * background is #F6E458, so the header's yellow badge would vanish into it -- the Panda
 * lockup this replaced was black-on-yellow for the same reason.
 *
 * The wordmark is a real text node rather than an SVG `<text>`. Satori hands the SVG to
 * resvg to rasterize, and resvg resolves fonts from its own database rather than from
 * the `fonts` passed to `ImageResponse` -- so an SVG `<text>` finds nothing and drops
 * silently. Laying it out as text lets it use the Onest face the card already loads.
 */
export const Logo = ({ style }: { style?: CSSProperties }) => (
  <div style={{ alignItems: 'center', display: 'flex', gap: '20px', ...style }}>
    <svg width="66" height="66" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 4.12886C0 2.01551 1.71321 0.302307 3.82656 0.302307H29.221C31.3343 0.302307 33.0475 2.01551 33.0475 4.12886V29.8711C33.0475 31.9845 31.3343 33.6977 29.221 33.6977H3.82656C1.71321 33.6977 0 31.9845 0 29.8711V4.12886Z"
        fill={BADGE}
      />
      <g fill={MARK}>
        <rect x="13.2" y="6.6" width="6.9" height="5.7" rx="1.7" />
        <rect x="13.2" y="13.5" width="6.9" height="6.5" rx="1.7" />
        <rect x="13.2" y="21.2" width="6.9" height="6" rx="1.7" />
        <path d="M20.6 12.4c3.1-.5 5.5-2.9 6-6-3.1.5-5.5 2.9-6 6z" />
        <path d="M12.7 20.4c-3.1-.5-5.5-2.9-6-6 3.1.5 5.5 2.9 6 6z" />
      </g>
    </svg>
    <div
      style={{
        color: BADGE,
        display: 'flex',
        fontFamily: 'Onest',
        fontSize: '52px',
        fontWeight: 700,
        letterSpacing: '-2px',
      }}
    >
      bamboo
    </div>
  </div>
)
