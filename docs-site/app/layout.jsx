import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import '../styles/globals.css'
import { NavDropdowns } from '../components/NavDropdowns'

export const metadata = {
  metadataBase: new URL('https://system-design-kb.vercel.app'),
  title: {
    template: '%s – System Design KB',
    default: 'System Design Knowledge Base',
  },
  description:
    'A comprehensive, production-ready guide to system design and interview preparation. Learn from real-world examples used at FAANG companies.',
  applicationName: 'System Design KB',
  appleWebApp: {
    title: 'System Design KB',
  },
  openGraph: {
    description:
      'A comprehensive, production-ready guide to system design and interview preparation. Learn from real-world examples used at FAANG companies.',
    siteName: 'System Design Knowledge Base',
    images: [{ url: 'https://system-design-kb.vercel.app/og.jpeg' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: 'system-design-kb.vercel.app',
    images: 'https://system-design-kb.vercel.app/og.jpeg',
  },
  other: {
    'msapplication-TileColor': '#fff',
  },
}

const logo = (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.3" />
      <path
        d="M2 17L12 22L22 17M2 12L12 17L22 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span style={{ fontWeight: 'bold', fontSize: '18px' }}>System Design KB</span>
  </div>
)

const navbar = (
  <Navbar
    logo={logo}
    projectLink="https://github.com/yourusername/system-design-kb"
  >
    {/* NavDropdowns is a 'use client' component — rendered as navbar extra content */}
    <NavDropdowns />
  </Navbar>
)

const footer = (
  <Footer>
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
      <span>MIT {new Date().getFullYear()} © System Design Knowledge Base</span>
      <span>Built with ❤️ for developers learning at scale</span>
    </div>
  </Footer>
)

export default async function RootLayout({ children }) {
  const pageMap = await getPageMap()

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head
        color={{
          hue: 212,
          saturation: 100,
          lightness: { dark: 65, light: 45 },
        }}
      >
        <meta name="theme-color" content="#fff" />
        <meta httpEquiv="Content-Language" content="en" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" type="image/png" />
      </Head>
      <body>
        <Banner storageKey="launch-banner">
          <a href="/system-design/12-interview-prep" style={{ textDecoration: 'none', color: 'inherit' }}>
            🎉 New: Interview Preparation section with 149+ real questions! Start here →
          </a>
        </Banner>
        <Layout
          navbar={navbar}
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/yourusername/system-design-kb/tree/main/docs-site"
          editLink="Edit this page on GitHub →"
          feedback={{
            content: 'Question? Give us feedback →',
            labels: 'feedback',
          }}
          footer={footer}
          sidebar={{
            defaultMenuCollapseLevel: 2,
            toggleButton: true,
          }}
          toc={{
            title: 'On This Page',
            backToTop: 'Back to top',
            extraContent: (
              <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
                <div>📚 100+ Articles</div>
                <div>💻 Production-Grade Code</div>
                <div>🎯 Interview-Ready</div>
              </div>
            ),
          }}
          navigation={{ prev: true, next: true }}
          darkMode={true}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
