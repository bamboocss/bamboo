import { Docs } from '.velite'
import { css } from '@/styled-system/css'
import { Flex } from '@/styled-system/jsx'
import { CopyMdxWidget } from './copy-mdx-widget'

interface Props {
  doc: Docs
}

export const Header = ({ doc }: Props) => {
  return (
    <Flex
      direction={{ base: 'column', md: 'row' }}
      justify={{ md: 'space-between' }}
      align="flex-start"
      gap="4"
      // Body paragraphs sit 6 apart (see mdx/text.tsx). 12 put the title block at
      // exactly double that, which read as a gap rather than as separation; 6 would
      // make the heading look like another paragraph. 8 splits them.
      mb="8"
      mt="8"
    >
      <div>
        <h1
          className={css({
            fontSize: { base: '3xl', md: '4xl' },
            fontWeight: 'bold',
            lineHeight: 'tight',
            mb: 2,
          })}
        >
          {doc.title}
        </h1>
        {doc.description && (
          <p className={css({ fontSize: 'lg', color: 'fg.muted', maxW: '3xl' })}>{doc.description}</p>
        )}
      </div>

      <CopyMdxWidget doc={doc} />
    </Flex>
  )
}
