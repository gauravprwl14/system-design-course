import nextra from 'nextra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const withNextra = nextra({
  defaultShowCopyCode: true,
  readingTime: true,
  latex: true,
  search: {
    codeblocks: false,
  }
})

// Base path configurable via .env — set NEXT_PUBLIC_BASE_PATH in .env.local
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/system-design'

export default withNextra({
  reactStrictMode: true,
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  experimental: {
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = { type: 'memory' }
    }
    return config
  },
})
