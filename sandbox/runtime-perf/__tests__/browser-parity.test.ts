import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import bamboocssPostcss from '@bamboocss/postcss'
import bamboocss from '@bamboocss/vite'
import { chromium, type Browser } from 'playwright'
import { build, preview, type PreviewServer } from 'vite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

/**
 * The strongest check available: two real builds, loaded in a real browser, compared on
 * what the browser actually computed.
 *
 * Everything else stops short of this. The SSR test compares markup strings, which shows
 * the class names survive but not that they *resolve* — a folded class backed by no rule,
 * or by a rule at different specificity, produces identical markup and a different page.
 * Computed styles are the property users actually care about, and the only way to read
 * them is to let a browser do the cascade.
 *
 * Both builds share one stylesheet, since the fold never changes CSS. That is exactly
 * what makes this meaningful: if folding rewrote a class into one the stylesheet does not
 * carry, the styles would diverge here and nowhere else.
 */
const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

/** Properties worth comparing: the ones the fixture's styles actually set. */
const TRACKED = [
  'display',
  'flex-direction',
  'align-items',
  'justify-content',
  'gap',
  'padding',
  'margin',
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'border-radius',
  'z-index',
  'text-overflow',
  'white-space',
  'overflow',
]

interface Snapshot {
  tag: string
  attrs: Record<string, string>
  text: string
  styles: Record<string, string>
}

let browser: Browser
const servers: PreviewServer[] = []

const buildAndServe = async (transform: boolean) => {
  const outDir = join(root, `dist-parity-${transform ? 'folded' : 'source'}`)

  await build({
    root,
    logLevel: 'silent',
    plugins: [bamboocss({ cwd: root, transform })],
    // Supplied here rather than discovered from postcss.config.cjs: under vitest the
    // workspace aliases make `@bamboocss/dev/postcss` resolve to something postcss's
    // file-based loader cannot take.
    css: { postcss: { plugins: [bamboocssPostcss({ cwd: root }) as never] } },
    build: { outDir, emptyOutDir: true, rollupOptions: { input: join(root, 'parity.html') } },
  })

  const server = await preview({
    root,
    logLevel: 'silent',
    preview: { port: 0 },
    css: { postcss: { plugins: [] } },
    build: { outDir },
  })
  servers.push(server)
  return server.resolvedUrls!.local[0]!
}

const snapshot = async (url: string): Promise<Snapshot[]> => {
  const page = await browser.newPage()
  await page.goto(`${url}parity.html`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#root > *')

  const result = await page.evaluate((tracked: string[]) => {
    const out: Array<Record<string, unknown>> = []

    for (const el of Array.from(document.querySelectorAll('#root, #root *'))) {
      const computed = getComputedStyle(el)
      const styles: Record<string, string> = {}
      for (const property of tracked) styles[property] = computed.getPropertyValue(property)

      const attrs: Record<string, string> = {}
      for (const attr of Array.from(el.attributes)) {
        // The class attribute is compared through the styles it produces, not by name:
        // the whole point of the fold is that the names change shape while the result
        // does not.
        if (attr.name !== 'class') attrs[attr.name] = attr.value
      }

      out.push({ tag: el.tagName, attrs, text: (el as HTMLElement).innerText ?? '', styles })
    }

    return out
  }, TRACKED)

  await page.close()
  return result as Snapshot[]
}

let source: Snapshot[] = []
let folded: Snapshot[] = []

beforeAll(async () => {
  browser = await chromium.launch()
  const [sourceUrl, foldedUrl] = await Promise.all([buildAndServe(false), buildAndServe(true)])
  source = await snapshot(sourceUrl)
  folded = await snapshot(foldedUrl)
}, 180_000)

afterAll(async () => {
  await Promise.all(servers.map((server) => new Promise((done) => server.httpServer.close(done))))
  await browser?.close()
})

describe('browser parity', () => {
  test('the page rendered something worth comparing', () => {
    // Guards against both sides being empty, or unstyled because the stylesheet never
    // reached the page.
    expect(source.length).toBeGreaterThan(10)
    expect(source.some((node) => node.styles.display === 'flex')).toBe(true)
    expect(source.some((node) => node.styles['background-color'] !== 'rgba(0, 0, 0, 0)')).toBe(true)
  })

  test('the two builds produced the same element tree', () => {
    expect(folded.map((node) => node.tag)).toEqual(source.map((node) => node.tag))
  })

  test('every element computes identical styles', () => {
    expect(folded.map((node) => node.styles)).toEqual(source.map((node) => node.styles))
  })

  test('every element carries identical attributes and text', () => {
    expect(folded.map((node) => ({ attrs: node.attrs, text: node.text }))).toEqual(
      source.map((node) => ({ attrs: node.attrs, text: node.text })),
    )
  })
})
