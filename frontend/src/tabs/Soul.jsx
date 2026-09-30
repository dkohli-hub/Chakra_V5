import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import Footer from '../components/Footer'
import { W_MAP } from '../constants'

export default function Soul() {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState(null)
  const { tasks } = state

  // AQ
  const active = tasks.filter(t => !t.completed)
  const hold = ['Dhairya', 'Vishram', 'Manan', 'Manthan', 'Tyaga', 'Prarabdha']
  const act = active.filter(t => !hold.includes(t.bucket))
  const aq = active.length > 0 ? Math.round((act.length / active.length) * 100) : 0
  // PQ
  const committed = tasks.filter(t => t.bucket === 'Karya')
  const done = committed.filter(t => t.completed)
  const wc = committed.reduce((s, t) => s + (W_MAP[t.weightage] || 0), 0)
  const wd = done.reduce((s, t) => s + (W_MAP[t.weightage] || 0), 0)
  const pq = wc > 0 ? Math.round((wd / wc) * 100) : 0
  // CQ
  const arenas = {}
  tasks.forEach(t => { if (t.ch) arenas[t.ch] = 1 })
  const cq = Math.round(Object.keys(arenas).length / 18 * 100)

  const qs = [
    { code: 'AQ', name: 'Adversity Quotient', score: aq, label: 'Actionable items / total active', desc: 'Your ability to move through stuck situations. High AQ means most of your open items are in your hands.' },
    { code: 'PQ', name: 'Karya Throughput', score: pq, label: 'Productivity percentage', desc: 'Weighted effort completed vs weighted effort committed, Karya only. How much of your committed work is actually landing.' },
    { code: 'CQ', name: 'Clarity Quotient', score: cq, label: 'Life arenas covered', desc: `Degree to which your tasks are structured and classified. ${Object.keys(arenas).length} of 18 Gita arenas have tasks.` }
  ]

  // AQ tap → tasks NOT in your hands; CQ tap → arenas NOT covered; PQ expands.
  function onTile(code) {
    if (code === 'AQ') dispatch({ type: 'SET_DETAIL', payload: { type: 'aq' } })
    else if (code === 'CQ') dispatch({ type: 'SET_DETAIL', payload: { type: 'cq' } })
    else setOpen(open === code ? null : code)
  }

  return (
    <>
      <div className="soul-hero">
        <div className="soul-hero-line">
          "The greatest gift you can give someone is your own personal development. I used to say, if you will take care of me, I will take care of you. Now I say, I will take care of me for you, if you will take care of you for me." — Jim Rohn
        </div>
      </div>
      <div className="q-grid">
        {qs.map(q => (
          <div key={q.code} className={`q-tile${open === q.code ? ' open' : ''}`} onClick={() => onTile(q.code)}>
            <div className="q-name">{q.name}</div>
            <div className="q-score">{q.score}</div>
            <div className="q-lbl">{q.label}</div>
            {open === q.code && (
              <div className="q-exp"><div className="q-desc">{q.desc}</div></div>
            )}
          </div>
        ))}
      </div>
      <Footer />
    </>
  )
}
