import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import TaskCard from '../components/TaskCard'
import Footer from '../components/Footer'
import { GITA, W_MAP } from '../constants'
import { completedAt, displayTitle } from '../utils'

function effortRows(tasks, win) {
  const since = Date.now() - win * 86400000
  return GITA.map(g => {
    const all = tasks.filter(t => t.ch === g.ch)
    const added = all.filter(t => t.entryTimestamp && new Date(t.entryTimestamp).getTime() >= since)
    const completed = all.filter(t => { const ca = completedAt(t); return t.completed && ca && new Date(ca).getTime() >= since })
    const addedW = added.reduce((s, t) => s + (W_MAP[t.weightage] || 0), 0)
    const completedW = completed.reduce((s, t) => s + (W_MAP[t.weightage] || 0), 0)
    return { ch: g.ch, name: g.name, addedW, completedW, demand: Math.max(addedW, completedW), addedN: added.length, completedN: completed.length }
  })
}

// Rule 22: stacked bar per arena on one shared axis — GREEN = effort completed in
// the window, RED = added but not yet done. An untouched arena draws hollow.
function EffortBars({ tasks, win, setWin }) {
  const { showToast } = useApp()
  let w = win
  let rows = effortRows(tasks, w)
  let touched = rows.reduce((s, r) => s + r.addedN + r.completedN, 0)
  // Nothing in 7d? Auto-widen to 30d once, silently.
  if (touched === 0 && w === 7) {
    w = 30
    rows = effortRows(tasks, w)
    touched = rows.reduce((s, r) => s + r.addedN + r.completedN, 0)
  }

  const header = (
    <div className="sec-hdr">
      <span className="sec-title">Arena Effort Bar</span>
      <span className="sec-count">
        <button className={`cal-btn${w === 7 ? ' go' : ' cancel'}`} style={{ padding: '2px 8px', fontSize: '10px', marginRight: '4px' }} onClick={() => setWin(7)}>7d</button>
        <button className={`cal-btn${w === 30 ? ' go' : ' cancel'}`} style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => setWin(30)}>30d</button>
      </span>
    </div>
  )

  if (touched === 0) {
    // Show why it's empty: the single most recent activity anywhere.
    let newestTs = 0, newestLabel = null
    tasks.forEach(t => {
      [t.entryTimestamp, completedAt(t)].forEach(ts => {
        if (!ts) return
        const ms = new Date(ts).getTime()
        if (ms > newestTs) { newestTs = ms; newestLabel = displayTitle(t) }
      })
    })
    const daysAgo = newestTs > 0 ? Math.floor((Date.now() - newestTs) / 86400000) : null
    return (
      <>
        {header}
        <div style={{ textAlign: 'center', padding: '28px 10px', color: 'var(--text-faint)' }}>
          <div style={{ fontSize: '30px', opacity: 0.5 }}>🌱</div>
          <div style={{ fontSize: '11px', marginTop: '6px' }}>No tasks added or finished in the last {w} days.</div>
          {daysAgo !== null && (
            <div style={{ fontSize: '10px', marginTop: '10px', color: 'var(--text-faint)', opacity: 0.8 }}>
              Most recent activity anywhere: "{(newestLabel || '').slice(0, 40)}" — {daysAgo} day{daysAgo === 1 ? '' : 's'} ago.
            </div>
          )}
        </div>
      </>
    )
  }

  const maxDemand = Math.max(...rows.map(r => r.demand), 1)
  rows.sort((a, b) => b.demand - a.demand)

  function explain(r) {
    const msg = (r.addedN + r.completedN === 0) ? `${r.name} — no activity in the last ${w} days.`
      : `${r.name} — last ${w}d: ${r.completedN} completed vs ${r.addedN} added. `
        + (r.completedN >= r.addedN ? 'You are keeping up.' : 'Tasks are coming in faster than you are finishing them.')
    showToast(msg, r.completedN >= r.addedN ? 'ok' : 'warn', 4000)
  }

  return (
    <>
      {header}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '2px 4px 8px', fontSize: '9px', color: 'var(--text-faint)' }}>
        <span><span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '2px', background: '#2E7D32', verticalAlign: 'middle', marginRight: '3px' }} />completed</span>
        <span><span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '2px', background: '#8B1A1A', verticalAlign: 'middle', marginRight: '3px' }} />backlog (added, not done)</span>
      </div>
      <div style={{ padding: '0 4px 10px' }}>
        {rows.map(r => {
          const greenPct = Math.round(r.completedW / maxDemand * 100)
          const redPct = Math.round(Math.max(0, r.addedW - r.completedW) / maxDemand * 100)
          const isEmpty = r.demand === 0
          const hoverTxt = `${r.name} — last ${w}d: ${r.completedN} completed vs ${r.addedN} added. `
            + (isEmpty ? 'No activity.' : r.completedN >= r.addedN ? 'Keeping up.' : 'Falling behind.')
          return (
            <div key={r.ch} onClick={() => explain(r)} title={hoverTxt} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer' }}>
              <div style={{ width: '110px', fontSize: '10px', color: isEmpty ? 'var(--text-faint)' : 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              <div style={{ flex: 1, background: 'var(--surface3)', border: `1px solid ${isEmpty ? 'var(--border)' : 'transparent'}`, borderRadius: '6px', height: '14px', overflow: 'hidden', display: 'flex', opacity: isEmpty ? 0.45 : 1 }}>
                {greenPct > 0 && <div style={{ width: `${greenPct}%`, height: '100%', background: '#2E7D32', boxShadow: 'inset -2px 0 0 rgba(255,255,255,.55)' }} />}
                {redPct > 0 && <div style={{ width: `${redPct}%`, height: '100%', background: '#8B1A1A' }} />}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default function Gita() {
  const { state } = useApp()
  const [openCh, setOpenCh] = useState(null)
  const [win, setWin] = useState(7)
  const tasks = state.tasks.filter(t => !t.completed)

  // Press-and-hold: one tile pressed at a time; taps on a task card inside the
  // pressed tile do not release it.
  function toggle(e, ch) {
    if (e.target.closest && e.target.closest('.gita-expanded .icard')) return
    setOpenCh(openCh === ch ? null : ch)
  }

  return (
    <>
      <EffortBars tasks={state.tasks} win={win} setWin={setWin} />
      <div className="gita-grid">
        {GITA.map(ch => {
          const chTasks = tasks.filter(t => t.ch === ch.ch)
          const cnt = chTasks.length
          const isOpen = openCh === ch.ch
          return (
            <div
              key={ch.ch}
              className={`gita-tile${isOpen ? ' open' : ''}`}
              role="button"
              aria-pressed={isOpen ? 'true' : 'false'}
              onClick={e => toggle(e, ch.ch)}
            >
              <div className="gita-ch">Ch {ch.ch}</div>
              <div className="gita-name" style={{ color: ch.color }}>{ch.name}</div>
              <div className="gita-essence">{ch.essence}</div>
              <div className="gita-count">{cnt} task{cnt !== 1 ? 's' : ''}</div>
              <div className="gita-expanded">
                <div className="gita-teaching">{ch.teaching}</div>
                {cnt > 0 && <div style={{ marginTop: '8px' }}>{chTasks.map(t => <TaskCard key={t.id} task={t} />)}</div>}
              </div>
            </div>
          )
        })}
      </div>
      <Footer />
    </>
  )
}
