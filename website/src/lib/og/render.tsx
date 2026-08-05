import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Logo } from './logo'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const DEFAULT_TITLE = 'Build time, type safe, CSS-in-JS'

interface OgImageProps {
  title?: string
  description?: string
  category?: string
}

const upperFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

const getFontSize = (title: string) => {
  if (title.length < 14) return '104px'
  if (title.length < 28) return '84px'
  return '64px'
}

// Read off disk rather than fetched. These images render at build time under
// `output: 'export'`, so there is no request to hang a fetch off -- and the
// module-scope `fetch` this replaced would have been an error on Workers, where
// a promise created in one request's I/O context cannot be awaited in another.
const loadFont = () => readFile(path.join(process.cwd(), 'styles', 'Onest-Bold.ttf'))

export const renderOgImage = async ({ title = DEFAULT_TITLE, description, category }: OgImageProps) =>
  new ImageResponse(
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        flexDirection: 'column',
        backgroundColor: '#F6E458',
        color: '#000000',
        padding: '80px',
      }}
    >
      <Logo style={{ marginBottom: '56px' }} />
      <div style={{ display: 'flex', gap: '0px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '72%',
            flex: '1',
          }}
        >
          {category && (
            <div
              style={{
                display: 'flex',
                fontFamily: 'Onest',
                color: '#7B722C',
                fontSize: '24px',
                marginBottom: '16px',
              }}
            >
              🎋 / {upperFirst(category)}
            </div>
          )}
          <div
            style={{
              fontSize: getFontSize(title),
              fontFamily: 'Onest',
              fontWeight: 700,
              letterSpacing: '-1.5px',
            }}
          >
            {upperFirst(title)}
          </div>
          {description && (
            <div
              style={{
                marginTop: '24px',
                fontSize: '28px',
                fontFamily: 'Onest',
                fontWeight: 400,
                color: '#7B722C',
                lineHeight: 1.4,
              }}
            >
              {description}
            </div>
          )}
          {!category && !description && (
            <div
              style={{
                marginTop: '40px',
                fontSize: '40px',
                fontFamily: 'Onest',
                fontWeight: 700,
                letterSpacing: '-1.5px',
                color: '#000000',
                borderRadius: '12px',
                backgroundColor: '#FFF',
                padding: '12px 24px',
                border: '6px solid #000000',
                boxShadow: '4px 3px 0px 0px #000',
                alignSelf: 'flex-start',
              }}
            >
              npm i -D @bamboocss/dev
            </div>
          )}
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        {
          name: 'Onest',
          data: await loadFont(),
          style: 'normal',
          weight: 700,
        },
      ],
    },
  )
