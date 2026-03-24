'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '/system-design'

const CORE_TOPICS = [
  { title: '🗄️ Databases',            href: `${BASE}/01-databases` },
  { title: '⚡ Caching',               href: `${BASE}/02-caching` },
  { title: '🔴 Redis',                 href: `${BASE}/03-redis` },
  { title: '📬 Messaging & Events',    href: `${BASE}/04-messaging` },
  { title: '⚖️ Distributed Systems',   href: `${BASE}/05-distributed-systems` },
  { title: '📈 Scalability',           href: `${BASE}/06-scalability` },
  { title: '🔥 Problems at Scale',     href: `${BASE}/problems-at-scale` },
]

const BUILD_TOPICS = [
  { title: '🌐 API Design',               href: `${BASE}/07-api-design` },
  { title: '🔒 Security',                 href: `${BASE}/08-security` },
  { title: '📡 Observability',            href: `${BASE}/09-observability` },
  { title: '🏗️ Architecture & Patterns',  href: `${BASE}/10-architecture` },
  { title: '🏢 Real-World Systems',       href: `${BASE}/11-real-world` },
  { title: '🤖 Agent Workflows',          href: `${BASE}/13-agent-workflows` },
  { title: '🧮 Algorithms',               href: `${BASE}/14-algorithms` },
  { title: '🧠 Vector Databases',         href: `${BASE}/15-vector-databases` },
]

function Dropdown({ title, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <div ref={ref} className="nav-dropdown">
      <button
        className="nav-dropdown-btn"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {title}
        <span className={`nav-dropdown-arrow ${open ? 'open' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="nav-dropdown-panel" role="menu">
          {items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-dropdown-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {item.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function NavDropdowns() {
  return (
    <div className="nav-dropdowns-desktop" style={{ display: 'flex', gap: '4px' }}>
      <Dropdown title="Core Topics"    items={CORE_TOPICS} />
      <Dropdown title="Build & Operate" items={BUILD_TOPICS} />
    </div>
  )
}
