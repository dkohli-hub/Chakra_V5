import React from 'react'
import { useApp } from '../store/AppContext'
import Footer from '../components/Footer'
import { isOD } from '../utils'

const NUM = { fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: '20px' }

export default function Score() {
  const { state } = useApp()
  const { tasks } = state

  const done = tasks.filter(t => t.completed)
  const karya = tasks.filter(t => t.bucket === 'Karya' || t.originBucket === 'Karya')
  const kDone = karya.filter(t => t.completed)
  const pct = karya.length > 0 ? Math.round((kDone.length / karya.length) * 100) : 0
  const od = tasks.filter(t => !t.completed && isOD(t)).length
  const col = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)'
  const lbl = pct >= 70 ? 'Strong field' : pct >= 40 ? 'In motion' : 'Heavy load'

  return (
    <div className="wrap">
      <div className="col" style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '6px' }} title="Percent of your Karya tasks (all-time) marked complete">
          Karmic Completion
        </div>
        <div className="score-big" style={{ color: col }}>{pct}<span style={{ fontSize: '22px' }}>%</span></div>
        <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px' }}>{lbl}</div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '14px' }}>
          <div title="Every task ever entered, done or not">
            <div style={{ fontSize: '9px', color: 'var(--text-faint)' }}>Total</div>
            <div style={{ ...NUM, color: 'var(--gold)' }}>{tasks.length}</div>
          </div>
          <div title="Tasks marked complete">
            <div style={{ fontSize: '9px', color: 'var(--text-faint)' }}>Done</div>
            <div style={{ ...NUM, color: 'var(--green)' }}>{done.length}</div>
          </div>
          <div title="Active tasks past their deadline, excluding anything already in Tamas">
            <div style={{ fontSize: '9px', color: 'var(--text-faint)' }}>Overdue</div>
            <div style={{ ...NUM, color: 'var(--red)' }}>{od}</div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
