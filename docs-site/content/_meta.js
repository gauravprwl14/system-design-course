export default {
  // ── True standalone pages (single .mdx file, no sub-pages) ────────────────
  index: {
    title: 'Home',
    type: 'page',
  },
  'get-started': {
    title: '🚀 Get Started',
    type: 'page',
  },

  // ── Folder sections visible in navbar — docs mode (NO type:'page') gives sidebar ──
  '00-start-here': {
    title: '🚀 Start Here',
  },
  '12-interview-prep': {
    title: '🎯 Interview Prep',
  },
  'cheat-sheets': {
    title: '⚡ Cheat Sheets',
  },
  'problems-at-scale': {
    title: '🔥 Problems at Scale',
  },

  // ── Hidden folder sections — accessible via NavDropdowns, have full sidebar ──
  '01-databases': {
    title: '🗄️ Databases',
    display: 'hidden',
  },
  '02-caching': {
    title: '⚡ Caching',
    display: 'hidden',
  },
  '03-redis': {
    title: '🔴 Redis',
    display: 'hidden',
  },
  '04-messaging': {
    title: '📬 Messaging & Events',
    display: 'hidden',
  },
  '05-distributed-systems': {
    title: '⚖️ Distributed Systems',
    display: 'hidden',
  },
  '06-scalability': {
    title: '📈 Scalability',
    display: 'hidden',
  },
  '07-api-design': {
    title: '🌐 API Design',
    display: 'hidden',
  },
  '08-security': {
    title: '🔒 Security',
    display: 'hidden',
  },
  '09-observability': {
    title: '📡 Observability',
    display: 'hidden',
  },
  '10-architecture': {
    title: '🏗️ Architecture & Patterns',
    display: 'hidden',
  },
  '11-real-world': {
    title: '🏢 Real-World Systems',
    display: 'hidden',
  },
  '13-agent-workflows': {
    title: '🤖 Agent Workflows',
    display: 'hidden',
  },
  '14-algorithms': {
    title: '🧮 Algorithms',
    display: 'hidden',
  },
  '15-vector-databases': {
    title: '🧠 Vector Databases',
    display: 'hidden',
  },
  'interview-prep': {
    title: '🎯 Interview Prep (legacy)',
    display: 'hidden',
  },
  'system-design': {
    title: '🏗️ System Design (legacy)',
    display: 'hidden',
  },
}
