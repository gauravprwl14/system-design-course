'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// NOTE: Next.js Link component automatically prepends basePath to all hrefs.
// Do NOT include the basePath prefix here — use paths relative to the content root.

const CORE_TOPICS = [
  { title: '🗄️ Databases',            href: '/01-databases' },
  { title: '⚡ Caching',               href: '/02-caching' },
  { title: '🔴 Redis',                 href: '/03-redis' },
  { title: '📬 Messaging & Events',    href: '/04-messaging' },
  { title: '⚖️ Distributed Systems',   href: '/05-distributed-systems' },
  { title: '📈 Scalability',           href: '/06-scalability' },
  { title: '🔥 Problems at Scale',     href: '/problems-at-scale' },
]

const BUILD_TOPICS = [
  { title: '🌐 API Design',               href: '/07-api-design' },
  { title: '🔒 Security',                 href: '/08-security' },
  { title: '📡 Observability',            href: '/09-observability' },
  { title: '🏗️ Architecture & Patterns',  href: '/10-architecture' },
  { title: '🏢 Real-World Systems',       href: '/11-real-world' },
  { title: '🤖 Agent Workflows',          href: '/13-agent-workflows' },
  { title: '🧮 Algorithms',               href: '/14-algorithms' },
  { title: '🧠 Vector Databases',         href: '/15-vector-databases' },
]

const MAIN_NAV = [
  { title: '🚀 Start Here',      href: '/00-start-here' },
  { title: '🎯 Interview Prep',  href: '/12-interview-prep' },
  { title: '⚡ Cheat Sheets',    href: '/cheat-sheets' },
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
    <div className="nav-dropdowns-desktop" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {MAIN_NAV.map(item => (
        <Link key={item.href} href={item.href} className="nav-plain-link">
          {item.title}
        </Link>
      ))}
      <Dropdown title="Core Topics"    items={CORE_TOPICS} />
      <Dropdown title="Build & Operate" items={BUILD_TOPICS} />
    </div>
  )
}
