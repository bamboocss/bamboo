import { Navbar } from '@/mdx/navbar'
import { css } from '@/styled-system/css'

export default function DocsLayout(props: React.PropsWithChildren) {
  const { children } = props
  return (
    <>
      <Navbar />
      <main
        className={css({
          // --navbar-height and --content-top live on `html` in theme/global-css.ts,
          // so the fixed navbar and this element read the same numbers.
          pt: 'var(--navbar-height)',
          pb: '32',
        })}
      >
        {children}
      </main>
    </>
  )
}
