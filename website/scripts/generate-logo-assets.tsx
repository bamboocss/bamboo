/**
 * Renders the brand asset set in `/assets` from the one mark definition below.
 *
 * These are the files a press page or a talk deck links to, so they are generated rather
 * than hand-drawn: the mark exists once here, and every lockup and square is a projection
 * of it. The set it replaces was Panda's, left behind by the rebrand because it was
 * raster art with no source.
 *
 * satori is used for exactly one thing -- outlining the wordmark against the embedded
 * font, so the SVGs carry glyph paths rather than a `<text>` node needing Onest
 * installed. Everything else is assembled here as literal path data, because satori
 * re-encodes an inline `<svg>` into a base64 `<image>` data URI: correct on screen, but
 * it makes a handout asset that no editor can open cleanly. resvg then rasterizes the
 * assembled SVG, so the two formats cannot drift.
 *
 * Run with `pnpm --filter=./website build:logo`.
 */
import { Resvg } from '@resvg/resvg-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import satori from 'satori'

const YELLOW = '#F6E458'
const BLACK = '#000000'
const WHITE = '#FFFFFF'

const OUT_DIR = path.join(process.cwd(), '..', 'assets')
const FONT = path.join(process.cwd(), 'styles', 'Onest-Bold.ttf')

/** Matches the dimensions of the Panda set these replace, so any existing embed still fits. */
const LOCKUP = { height: 261, width: 970 }
const SQUARE = 1173

/** The badge is drawn in a 34-unit box, as in `theme/icons.tsx`. */
const BOX = 34
const BADGE_PATH =
  'M0 4.12886C0 2.01551 1.71321 0.302307 3.82656 0.302307H29.221C31.3343 0.302307 33.0475 2.01551 33.0475 4.12886V29.8711C33.0475 31.9845 31.3343 33.6977 29.221 33.6977H3.82656C1.71321 33.6977 0 31.9845 0 29.8711V4.12886Z'

/**
 * Frames the square assets on the stalk's own bounding box rather than on the 34-unit
 * box, which is sized for the badge around it. Centred on the badge's box, the leaves
 * push the visual mass up-right and the mark reads as both off-centre and adrift.
 */
const MARK_BOX = { size: 27, x: 3.15, y: 3.3 }

const roundedRect = (x: number, y: number, w: number, h: number, r: number) =>
  [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ')

/** Three segments with a leaf at each joint, in the same 34-unit box as the badge. */
const STALK = [
  roundedRect(13.2, 6.6, 6.9, 5.7, 1.7),
  roundedRect(13.2, 13.5, 6.9, 6.5, 1.7),
  roundedRect(13.2, 21.2, 6.9, 6, 1.7),
  'M20.6 12.4c3.1-.5 5.5-2.9 6-6-3.1.5-5.5 2.9-6 6z',
  'M12.7 20.4c-3.1-.5-5.5-2.9-6-6 3.1.5 5.5 2.9 6 6z',
]

const paths = (data: string[], fill: string) => data.map((d) => `<path d="${d}" fill="${fill}"/>`).join('')

const svgDocument = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${body}</svg>`

/**
 * Lays the wordmark out beside a spacer standing in for the badge, and returns the glyph
 * outlines satori produces. The spacer means the path comes back already positioned in
 * the lockup's coordinate space, so it can be dropped into the assembled document as-is.
 */
const outlineWordmark = async (fontData: Buffer) => {
  const svg = await satori(
    <div style={{ alignItems: 'center', display: 'flex', height: '100%', width: '100%' }}>
      <div style={{ display: 'flex', height: `${LOCKUP.height}px`, width: `${LOCKUP.height}px` }} />
      <div
        style={{
          color: BLACK,
          display: 'flex',
          fontFamily: 'Onest',
          fontSize: '172px',
          fontWeight: 700,
          letterSpacing: '-7px',
          marginLeft: '56px',
        }}
      >
        bamboo
      </div>
    </div>,
    {
      fonts: [{ data: fontData, name: 'Onest', style: 'normal', weight: 700 }],
      height: LOCKUP.height,
      width: LOCKUP.width,
    },
  )

  const match = svg.match(/<path[^>]*\bd="([^"]+)"/)
  if (!match) throw new Error('satori produced no wordmark outline -- did the font fail to load?')

  return match[1]
}

const main = async () => {
  const fontData = await readFile(FONT)
  const wordmark = await outlineWordmark(fontData)
  await mkdir(OUT_DIR, { recursive: true })

  const lockupScale = LOCKUP.height / BOX
  const lockup = (badge: string, mark: string) =>
    svgDocument(
      LOCKUP.width,
      LOCKUP.height,
      `<g transform="scale(${lockupScale})">${paths([BADGE_PATH], badge)}${paths(STALK, mark)}</g>` +
        `<path d="${wordmark}" fill="${BLACK}"/>`,
    )

  const squareScale = SQUARE / MARK_BOX.size
  const square = (field: string, mark: string) =>
    svgDocument(
      SQUARE,
      SQUARE,
      `<rect width="${SQUARE}" height="${SQUARE}" fill="${field}"/>` +
        `<g transform="scale(${squareScale}) translate(${-MARK_BOX.x} ${-MARK_BOX.y})">${paths(STALK, mark)}</g>`,
    )

  const assets = [
    { name: 'logo-main', svg: lockup(YELLOW, BLACK), width: LOCKUP.width },
    { name: 'logo-black', svg: lockup(BLACK, WHITE), width: LOCKUP.width },
    { name: 'logo-on-yellow', svg: square(YELLOW, BLACK), width: SQUARE },
    { name: 'logo-on-black', svg: square(BLACK, YELLOW), width: SQUARE },
  ]

  for (const { name, svg, width } of assets) {
    await writeFile(path.join(OUT_DIR, `${name}.svg`), svg)
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
    await writeFile(path.join(OUT_DIR, `${name}.png`), png)
  }

  console.log(`🎋 info [logo] rendered ${assets.length} brand assets to assets/`)
}

// Not top-level await: the website package is CJS, and a silent failure here would leave
// the previous brand's art in place looking like a successful run.
main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
