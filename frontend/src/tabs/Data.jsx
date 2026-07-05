import React from 'react'
import { useApp } from '../store/AppContext'
import { BUCKET_COLORS, WEIGHT_COLORS } from '../constants'

function Bars({ obj, cols, tot }) {
  return Object.keys(obj).sort((a, b) => obj[b] - obj[a]).map(k => (
    <div key={k} className="bar-row">
      <div className="bar-lbl">{k}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.round(obj[k] / tot * 100)}%`, background: cols?.[k] || 'var(--gold)' }} />
      </div>
      <div className="bar-val">{obj[k]}</div>
    </div>
  ))
}

export default function Data() {
  const { state } = useApp()
  const tasks = state.tasks.filter(t => !t.completed)
  const tot = tasks.length || 1
  const bkCounts = {}, laCounts = {}, wCounts = {}
  tasks.forEach(t => {
    bkCounts[t.bucket] = (bkCounts[t.bucket] || 0) + 1
    laCounts[t.lifeArea || 'Other'] = (laCounts[t.lifeArea || 'Other'] || 0) + 1
    wCounts[t.weightage || '?'] = (wCounts[t.weightage || '?'] || 0) + 1
  })

  return (
    <div className="wrap">
      <div className="col">
        <div className="col-hdr"><div className="col-name" style={{ color: 'var(--gold)' }}>By Bucket</div></div>
        <div className="col-body"><Bars obj={bkCounts} cols={BUCKET_COLORS} tot={tot} /></div>
      </div>
      <div className="col">
        <div className="col-hdr"><div className="col-name" style={{ color: 'var(--gold)' }}>By Life Area</div></div>
        <div className="col-body"><Bars obj={laCounts} tot={tot} /></div>
      </div>
      <div className="col">
        <div className="col-hdr"><div className="col-name" style={{ color: 'var(--gold)' }}>By Weightage</div></div>
        <div className="col-body"><Bars obj={wCounts} cols={WEIGHT_COLORS} tot={tot} /></div>
      </div>
      <div className="page-footer">
        <div className="footer-disc">
          These are signals, not certainties. The quality and accuracy of what Chakra reads depends entirely on what you have put in.
        </div>
      </div>
    </div>
  )
}
