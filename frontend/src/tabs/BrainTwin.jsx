import React from 'react'
import { useApp } from '../store/AppContext'

export default function BrainTwin() {
  const { state } = useApp()
  const { tasks } = state
  const tot = tasks.length || 1

  const vol = Math.min(tasks.length / 100, 1)
  const heavy = tasks.filter(t => t.weightage === 'W4' || t.weightage === 'W5')
  const rajas = Math.round(((vol * 0.3) + (Math.min(tasks.length / 70, 1) * 0.4) + (tasks.length > 0 ? heavy.length / tasks.length : 0) * 0.3) * 100)

  const hold = ['Dhairya', 'Vishram', 'Manan', 'Manthan']
  const stag = tasks.filter(t => hold.includes(t.bucket) && (t.agingDays || 0) > 14 && !t.completed)
  const defl = tasks.filter(t => (t.transitionCount || 0) > 3 && !t.completed)
  const tamas = Math.round(((stag.length / tot * 0.5) + (defl.length / tot * 0.5)) * 100)

  const sb = ['Manan', 'Manthan']
  const intent = tasks.filter(t => sb.includes(t.bucket) && !t.completed)
  const clean = tasks.filter(t => t.completed && (t.transitionCount || 0) <= 1)
  const sattva = Math.round(((Math.min(intent.length / tot, 1) * 0.3) + (Math.min(clean.length / tot, 1) * 0.7)) * 100)

  const gTotal = rajas + tamas + sattva || 1
  const gr = Math.round(rajas / gTotal * 100)
  const gt = Math.round(tamas / gTotal * 100)
  const gs = Math.round(sattva / gTotal * 100)

  const small = tasks.filter(t => t.weightage === 'W1' || t.weightage === 'W2').length
  const large = tasks.filter(t => t.weightage === 'W3' || t.weightage === 'W4').length
  const huge  = tasks.filter(t => t.weightage === 'W5').length

  return (
    <div className="wrap">
      <div className="col">
        <div className="col-hdr">
          <div className="col-name" style={{ color: 'var(--gold)' }}>Guna Balance</div>
        </div>
        <div className="col-body">
          {[['Rajas', gr, '#B87800', 'Drive · Action · Momentum'],
            ['Tamas', gt, '#5A5A7A', 'Weight · Inertia · Holding'],
            ['Sattva', gs, '#2E7D32', 'Clarity · Intention · Resolution']
          ].map(([name, pct, col, desc]) => (
            <div key={name} className="bar-row">
              <div className="bar-lbl">{name} {pct}%</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%`, background: col }} />
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-faint)', paddingLeft: '8px' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="col">
        <div className="col-hdr">
          <div className="col-name" style={{ color: 'var(--gold)' }}>Load Distribution</div>
        </div>
        <div className="col-body">
          {[['Small (W1–W2)', small, '#2E7D32'],
            ['Large (W3–W4)', large, '#B87800'],
            ['Full day (W5)', huge, '#8B1A1A']
          ].map(([name, count, col]) => (
            <div key={name} className="bar-row">
              <div className="bar-lbl">{name}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.round(count / tot * 100)}%`, background: col }} />
              </div>
              <div className="bar-val" style={{ color: col }}>{count}</div>
            </div>
          ))}
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
