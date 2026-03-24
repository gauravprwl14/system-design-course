import { generateStaticParamsFor, importPage } from 'nextra/pages'

// Generate static params for all MDX files in content/
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
  const { default: MDXContent } = await importPage(params.mdxPath)
  return <MDXContent {...props} params={params} />
}
