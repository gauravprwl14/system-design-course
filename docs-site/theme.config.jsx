import { useRouter } from 'next/router'
import { useConfig } from 'nextra-theme-docs'

export default {
  logo: (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.3"/>
        <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontWeight: 'bold', fontSize: '18px' }}>System Design KB</span>
    </div>
  ),
  project: {
    link: 'https://github.com/yourusername/system-design-kb'
  },
  docsRepositoryBase: 'https://github.com/yourusername/system-design-kb/tree/main/docs-site',
  useNextSeoProps() {
    const { asPath } = useRouter()
    if (asPath !== '/') {
      return {
        titleTemplate: '%s – System Design KB'
      }
    }
  },
  head: function useHead() {
    const { title } = useConfig()
    const { route } = useRouter()
    const socialCard =
      route === '/' || !title
        ? 'https://system-design-kb.vercel.app/og.jpeg'
        : `https://system-design-kb.vercel.app/api/og?title=${title}`

    return (
      <>
        <meta name="msapplication-TileColor" content="#fff" />
        <meta name="theme-color" content="#fff" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta
          name="description"
          content="A comprehensive, production-ready guide to system design and interview preparation. Learn from real-world examples used at FAANG companies."
        />
        <meta
          name="og:description"
          content="A comprehensive, production-ready guide to system design and interview preparation. Learn from real-world examples used at FAANG companies."
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={socialCard} />
        <meta name="twitter:site:domain" content="system-design-kb.vercel.app" />
        <meta name="twitter:url" content="https://system-design-kb.vercel.app" />
        <meta name="og:title" content={title ? title + ' – System Design KB' : 'System Design Knowledge Base'} />
        <meta name="og:image" content={socialCard} />
        <meta name="apple-mobile-web-app-title" content="System Design KB" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" type="image/png" />
      </>
    )
  },
  editLink: {
    text: 'Edit this page on GitHub →'
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback'
  },
  sidebar: {
    titleComponent({ title, type }) {
      if (type === 'separator') {
        return <div style={{ fontWeight: 'bold', marginTop: '16px' }}>{title}</div>
      }
      return <>{title}</>
    },
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  footer: {
    text: (
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <span>
          MIT {new Date().getFullYear()} © System Design Knowledge Base
        </span>
        <span>
          Built with ❤️ for developers learning at scale
        </span>
      </div>
    )
  },
  toc: {
    backToTop: true,
    title: 'On This Page',
    extraContent: (
      <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
        <div>📚 100+ Articles</div>
        <div>💻 Production-Grade Code</div>
        <div>🎯 Interview-Ready</div>
      </div>
    )
  },
  navigation: {
    prev: true,
    next: true
  },
  darkMode: true,
  primaryHue: 212,
  primarySaturation: 100,
  search: {
    placeholder: 'Search documentation...',
    loading: 'Loading...',
    error: 'Failed to load search index'
  },
  banner: {
    key: 'launch-banner',
    text: (
      <a href="/get-started" style={{ textDecoration: 'none' }}>
        🎉 New: Interview Preparation section with 149+ real questions! Start here →
      </a>
    )
  }
}
