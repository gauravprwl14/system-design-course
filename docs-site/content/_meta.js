export default {
  // ── Standalone pages ─────────────────────────────────────────────────────
  index: {
    title: 'Home',
    type: 'page',
  },
  'get-started': {
    title: '🚀 Get Started',
    type: 'page',
  },

  // ── Pillar 1: Foundations ─────────────────────────────────────────────────
  '_sep_foundations': {
    type: 'separator',
    title: '🏗️ Foundations',
  },
  '01-databases': {
    title: '🗄️ Databases',
  },
  '02-caching': {
    title: '⚡ Caching',
  },
  '03-redis': {
    title: '🔴 Redis',
  },
  '04-messaging': {
    title: '📬 Messaging & Events',
  },
  '05-distributed-systems': {
    title: '⚖️ Distributed Systems',
  },

  // ── Pillar 2: Production Systems ──────────────────────────────────────────
  '_sep_production': {
    type: 'separator',
    title: '🚀 Production Systems',
  },
  '06-scalability': {
    title: '📈 Scalability',
  },
  '07-api-design': {
    title: '🌐 API Design',
  },
  '08-security': {
    title: '🔒 Security',
  },
  '09-observability': {
    title: '📡 Observability',
  },
  '10-architecture': {
    title: '🏗️ Architecture & Patterns',
  },

  // ── Pillar 3: AI & Modern Systems ─────────────────────────────────────────
  '_sep_ai': {
    type: 'separator',
    title: '🤖 AI & Modern Systems',
  },
  '13-agent-workflows': {
    title: '🤖 AI Agents',
  },
  '15-vector-databases': {
    title: '🧠 Vector Databases',
  },
  '14-algorithms': {
    title: '🧮 Algorithms',
  },

  // ── Pillar 4: Problem Sets ────────────────────────────────────────────────
  '_sep_problems': {
    type: 'separator',
    title: '🏗️ System Design Problems',
  },
  '16-system-design-problems': {
    title: '🏗️ 163 Problems',
  },

  // ── Pillar 5: Prep & Reference ────────────────────────────────────────────
  '_sep_prep': {
    type: 'separator',
    title: '🎯 Prep & Reference',
  },
  'problems-at-scale': {
    title: '🔥 Problems at Scale',
  },
  '12-interview-prep': {
    title: '🎯 Interview Questions',
  },
  '11-real-world': {
    title: '🏢 Real-World Case Studies',
  },
  'cheat-sheets': {
    title: '⚡ Cheat Sheets',
  },

  // ── Hidden legacy sections ────────────────────────────────────────────────
  // NOTE: '00-start-here' is intentionally omitted from the sidebar.
  // Its content (learning-paths.md) is linked from the home page.
  // The route /00-start-here/learning-paths still works — it just has no sidebar entry.
  'interview-prep': {
    title: '🎯 Interview Prep (legacy)',
    display: 'hidden',
  },
  'system-design': {
    title: '🏗️ System Design (legacy)',
    display: 'hidden',
  },
}
