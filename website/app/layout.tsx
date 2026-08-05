import { css, cx } from '@/styled-system/css'
import { fontClassName } from 'styles/fonts'
import seoConfig from '../seo.config'
import '../styles/bamboo.css'

interface Props {
  children: React.ReactNode
}

const { themeColor: _, ...metadata } = seoConfig
export { metadata }

export const viewport = {
  viewport: seoConfig.themeColor,
}

export default function RootLayout(props: Props) {
  const { children } = props
  return (
    // Font size is set once, on `html` in theme/global-css.ts. It was also set here as
    // an atomic class, which won on specificity -- so changing the global rule alone
    // had no effect at all.
    <html lang="en" className={cx('dark', fontClassName, css({ fontFamily: 'body' }))}>
      <body>{children}</body>
    </html>
  )
}
