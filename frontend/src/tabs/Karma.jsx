import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import TaskCard from '../components/TaskCard'
import Footer from '../components/Footer'
import { BUCKETS } from '../constants'

// A glass-beaker SVG: liquid fill tied to task count, subtle glass highlight.
// Each call gets a unique gradient id so multiple beakers never collide.
function Beaker({ pct, color, uid }) {
  const p = Math.max(4, Math.min(96, pct))
  const liquidTop = 100 - p
  return (
    <svg viewBox="0 0 80 100" width="64" height="80">
      <defs>
        <linearGradient id={`liq${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.85" />
        </linearGradient>
        <clipPath id={`clip${uid}`}>
          <path d="M22 8 L22 34 L8 88 Q8 94 16 94 L64 94 Q72 94 72 88 L58 34 L58 8 Z" />
        </clipPath>
      </defs>
      <path d="M22 8 L22 34 L8 88 Q8 94 16 94 L64 94 Q72 94 72 88 L58 34 L58 8" fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" opacity=".8" />
      <rect x="17" y="5" width="46" height="7" rx="2" fill="none" stroke={color} strokeWidth="2.5" opacity=".8" />
      <rect x="4" y={liquidTop} width="72" height={p} fill={`url(#liq${uid})`} clipPath={`url(#clip${uid})`} />
      <path d="M26 20 L26 33" stroke="#fff" strokeWidth="2" opacity=".35" strokeLinecap="round" />
    </svg>
  )
}

export default function Karma() {
  const { state } = useApp()
  const [openKey, setOpenKey] = useState(null)
  const tasks = state.tasks.filter(t => !t.completed)

  if (openKey) {
    const bk = BUCKETS.find(b => b.key === openKey)
    const items = tasks.filter(t => t.bucket === openKey)
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <button className="back-btn" onClick={() => setOpenKey(null)}><span className="back-arrow">←</span>Back</button>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '20px', fontWeight: 600, color: bk.col }}>{bk.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{bk.sub}</div>
          </div>
        </div>
        <div className="wrap">
          {items.length
            ? items.map(t => <TaskCard key={t.id} task={t} />)
            : <div style={{ fontSize: '12px', color: 'var(--text-faint)', padding: '10px 0' }}>Nothing here right now.</div>}
        </div>
        <Footer />
      </>
    )
  }

  // Primary screen: beakers only. Fixed 3-column grid, capped width and centered.
  const counts = BUCKETS.map(b => tasks.filter(t => t.bucket === b.key).length)
  const maxCnt = Math.max(...counts, 1)

  return (
    <>
      <div style={{ maxWidth: '520px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '22px 18px', padding: '20px 8px' }}>
        {BUCKETS.map((bk, i) => {
          const cnt = counts[i]
          return (
            <div
              key={bk.key}
              onClick={() => setOpenKey(bk.key)}
              title={bk.sub}
              className="karma-beaker"
              style={{
                textAlign: 'center', cursor: 'pointer',
                background: `radial-gradient(circle at 50% 38%,${bk.col}2E 0%,${bk.col}12 45%,var(--surface) 80%)`,
                border: `1px solid ${bk.col}66`,
                boxShadow: `0 0 18px ${bk.col}55,0 0 42px ${bk.col}2A,inset 0 0 22px ${bk.col}22`,
                borderRadius: '16px', padding: '16px 8px 12px', transition: 'transform .15s',
              }}
            >
              <Beaker pct={Math.round(cnt / maxCnt * 100)} color={bk.col} uid={i} />
              <div style={{ fontSize: '22px', fontWeight: 700, color: bk.col, marginTop: '4px' }}>{cnt}</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontWeight: 600 }}>{bk.key}</div>
            </div>
          )
        })}
      </div>
      <Footer />
    </>
  )
}
