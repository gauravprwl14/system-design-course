import nextra from 'nextra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Nextra 4: theme/themeConfig are removed — theme is configured via app/layout.jsx
const withNextra = nextra({
  defaultShowCopyCode: true,
  readingTime: true,
  latex: true,
  search: {
    codeblocks: false,  // skip indexing 2000+ code blocks at compile time
  }
})

export default withNextra({
  reactStrictMode: true,
  basePath: '/system-design',
  assetPrefix: '/system-design',

  // skip TypeScript type checking during build (run tsc --noEmit separately)
  typescript: {
    ignoreBuildErrors: true,
  },

  // skip source map generation — saves significant time at 247k lines
  productionBrowserSourceMaps: false,

  experimental: {
    // NOTE: nextra/nextra-theme-docs intentionally excluded from optimizePackageImports —
    // Nextra's own build pipeline opts out of this optimization (it breaks SSR for search).

    // run webpack in a separate worker — reduces peak memory, improves wall-clock time
    webpackBuildWorker: true,

    // reduce webpack memory footprint on large builds
    webpackMemoryOptimizations: true,
  },

  webpack: (config, { dev }) => {
    if (!dev) {
      // force in-memory cache only — the on-disk webpack cache can grow to
      // 3+ GB for 500+ file sites and actually slow down builds via I/O
      config.cache = { type: 'memory' }
    }
    return config
  },
})
