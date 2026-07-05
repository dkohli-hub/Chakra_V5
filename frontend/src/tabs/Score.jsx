import React from 'react'
import { useApp } from '../store/AppContext'
import { isOD } from '../utils'

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
        <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '6px' }}>
          Karmic Completion
        </div>
        <div className="score-big" style={{ color: col }}>{pct}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px' }}>{lbl}</div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '14px' }}>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--text-faint)' }}>Total</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', color: 'var(--gold)' }}>{tasks.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--text-faint)' }}>Done</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', color: 'var(--green)' }}>{done.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--text-faint)' }}>Overdue</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', color: 'var(--red)' }}>{od}</div>
          </div>
        </div>
      </div>
      <div className="page-footer">
        <div className="footer-disc">
          These are signals, not certainties. The quality and accuracy of what Chakra reads depends entirely on what you have put in.
        </div>
      </div>
    </div>
  )
}
