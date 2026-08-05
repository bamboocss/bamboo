import { Navbar } from '@/mdx/navbar'
import { css } from '@/styled-system/css'

export default function DocsLayout(props: React.PropsWithChildren) {
  const { children } = props
  return (
    <>
      <Navbar />
      <main
        className={css({
          '--navbar-height': '4rem',
          // Where the three columns begin. The sidebar and table of contents are
          // sticky and position against the viewport, while the article sits in
          // normal flow under this padding -- so without a shared value they drift
          // apart whenever one of them is adjusted.
          '--content-top': 'calc(var(--navbar-height) + 4rem)',
          pt: 'var(--navbar-height)',
          pb: '32',
        })}
      >
        {children}
      </main>
    </>
  )
}
