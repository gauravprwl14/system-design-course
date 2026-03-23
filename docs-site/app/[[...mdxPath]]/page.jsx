import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { useMDXComponents } from '../../mdx-components'

// Generate static params for all MDX files in pages/
export const generateStaticParams = generateStaticParamsFor('mdxPath')

// Generate per-page metadata from MDX frontmatter
export async function generateMetadata(props) {
  const params = await props.params
  const { metadata } = await importPage(params.mdxPath)
  return metadata
}

// Catch-all page — renders any MDX file routed through [[...mdxPath]]
export default async function Page(props) {
  const params = await props.params
  const result = await importPage(params.mdxPath)
  const { default: MDXContent, toc, metadata } = result

  const { wrapper: Wrapper } = useMDXComponents()

  if (Wrapper) {
    return (
      <Wrapper toc={toc} metadata={metadata}>
        <MDXContent {...props} params={params} />
      </Wrapper>
    )
  }

  return <MDXContent {...props} params={params} />
}
