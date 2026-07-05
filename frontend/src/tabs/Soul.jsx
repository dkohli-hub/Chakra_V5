import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { W_MAP } from '../constants'

export default function Soul() {
  const { state } = useApp()
  const [open, setOpen] = useState(null)
  const { tasks } = state

  const active = tasks.filter(t => !t.completed)
  const hold = ['Dhairya', 'Vishram', 'Manan', 'Manthan', 'Tyaga', 'Prarabdha']
  const act = active.filter(t => !hold.includes(t.bucket))
  const aq = active.length > 0 ? Math.round((act.length / active.length) * 100) : 0

  const committed = tasks.filter(t => t.bucket === 'Karya')
  const done = committed.filter(t => t.completed)
  const wc = committed.reduce((s, t) => s + (W_MAP[t.weightage] || 0), 0)
  const wd = done.reduce((s, t) => s + (W_MAP[t.weightage] || 0), 0)
  const pq = wc > 0 ? Math.round((wd / wc) * 100) : 0

  const arenas = {}
  tasks.forEach(t => { if (t.ch) arenas[t.ch] = 1 })
  const cq = Math.round(Object.keys(arenas).length / 18 * 100)

  const qs = [
    { code: 'AQ', name: 'Adversity Quotient', score: aq, label: 'Actionable items / total active', desc: 'Your ability to move through stuck situations. High AQ means most of your open items are in your hands.' },
    { code: 'PQ', name: 'Purpose Quotient', score: pq, label: 'Weighted Karya completion', desc: 'Alignment of active attention with what is genuinely meaningful. Measures the weight of completed Karya vs committed.' },
    { code: 'CQ', name: 'Clarity Quotient', score: cq, label: 'Life arenas covered', desc: `Degree to which your tasks are structured and classified. ${Object.keys(arenas).length} of 18 Gita arenas have tasks.` }
  ]

  return (
    <>
      <div className="soul-hero">
        <div className="soul-hero-line">
          "The greatest gift you can give someone is your own personal development. I used to say, if you will take care of me, I will take care of you. Now I say, I will take care of me for you, if you will take care of you for me." — Jim Rohn
        </div>
      </div>
      <div className="q-grid">
        {qs.map(q => (
          <div key={q.code} className={`q-tile${open === q.code ? ' open' : ''}`} onClick={() => setOpen(open === q.code ? null : q.code)}>
            <div className="q-name">{q.name}</div>
            <div className="q-score">{q.score}</div>
            <div className="q-lbl">{q.label}</div>
            {open === q.code && (
              <div className="q-exp">
                <div className="q-desc">{q.desc}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="page-footer">
        <div className="footer-disc">
          These are signals, not certainties. The quality and accuracy of what Chakra reads depends entirely on what you have put in.
        </div>
      </div>
    </>
  )
}
