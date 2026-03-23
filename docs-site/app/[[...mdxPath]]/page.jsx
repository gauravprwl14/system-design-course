import { generateStaticParamsFor, importPage } from 'nextra/pages'

// Generate static params for all MDX files in content/
export const generateStaticParams = generateStaticParamsFor('mdxPath')

// Generate per-page metadata from MDX frontmatter
export { generateMetadata } from 'nextra/pages'

// Catch-all page — renders any MDX file routed through [[...mdxPath]]
// NOTE: useMDXComponents() must NOT be called inside an async Server Component
// (React 19 disallows hooks in async functions). The Nextra theme Layout in
// app/layout.jsx handles wrapping automatically — MDXContent is rendered directly.
export default async function Page(props) {
  const params = await props.params
  const { default: MDXContent } = await importPage(params.mdxPath)
  return <MDXContent {...props} params={params} />
}
