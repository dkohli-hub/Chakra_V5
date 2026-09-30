import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import Footer from '../components/Footer'
import { wLabel } from '../utils'

const PIE_FALLBACK = ['#1A6B5A', '#A07828', '#3A6B8A', '#6A3A8A', '#B87800', '#2E7D32', '#8B1A1A', '#5A5A7A']
const LA_COL = { 'Personal/Family': '#1A6B5A', 'Picturizze': '#A07828', 'Work/Employment': '#3A6B8A', 'Other': '#6A3A8A' }
const B_COL = { Karya: '#A07828', Dhairya: '#B87800', Vishram: '#5A5A7A', Manan: '#8B6914', Manthan: '#3A6B8A', Tyaga: '#2E7D32', Prarabdha: '#6A3A8A' }
const W_COL = { W1: '#2E7D32', W2: '#A07828', W3: '#3A6B8A', W4: '#B87800', W5: '#8B1A1A' }

function sortedKeys(obj) { return Object.keys(obj).sort((a, b) => obj[b] - obj[a]) }

function Bars({ obj, cols, tot, labelFn }) {
  return sortedKeys(obj).map((k, i) => (
    <div key={k} className="bar-row">
      <div className="bar-lbl">{labelFn ? labelFn(k) : k}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.round(obj[k] / tot * 100)}%`, background: (cols && cols[k]) || PIE_FALLBACK[i % PIE_FALLBACK.length] }} />
      </div>
      <div className="bar-val">{obj[k]}</div>
    </div>
  ))
}

function shade(hex, f) {
  let h = String(hex).replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  if (isNaN(n)) return hex
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f))
  const b = Math.min(255, Math.round((n & 255) * f))
  return `rgb(${r},${g},${b})`
}

// 3D pie — tilted disc with visible thickness, soft shadow and gloss. Pure SVG.
function Pie({ obj, cols, tot, uid }) {
  const keys = sortedKeys(obj)
  const cx = 66, cy = 42, rx = 58, ry = 32, dep = 16, W = 132, H = 104
  const P = (a, dy = 0) => { const r = a * Math.PI / 180; return [cx + rx * Math.sin(r), cy - ry * Math.cos(r) + dy] }
  const f = n => n.toFixed(2)
  let acc = 0
  const walls = [], tops = []
  keys.forEach((k, i) => {
    const col = (cols && cols[k]) || PIE_FALLBACK[i % PIE_FALLBACK.length]
    const a0 = acc / tot * 360
    acc += obj[k]
    const a1 = Math.min(acc / tot * 360, a0 + 359.99)
    const s0 = Math.max(a0, 90), e0 = Math.min(a1, 270)
    if (s0 < e0) {
      const p0 = P(s0), p1 = P(e0), q0 = P(s0, dep), q1 = P(e0, dep), lg = (e0 - s0) > 180 ? 1 : 0
      walls.push(<path key={`w${k}`} d={`M${f(p0[0])} ${f(p0[1])} A${rx} ${ry} 0 ${lg} 1 ${f(p1[0])} ${f(p1[1])} L${f(q1[0])} ${f(q1[1])} A${rx} ${ry} 0 ${lg} 0 ${f(q0[0])} ${f(q0[1])} Z`} fill={shade(col, 0.6)} stroke={shade(col, 0.6)} strokeWidth="0.6" />)
    }
    const t0 = P(a0), t1 = P(a1), lgt = (a1 - a0) > 180 ? 1 : 0
    tops.push(<path key={`t${k}`} d={`M${cx} ${cy} L${f(t0[0])} ${f(t0[1])} A${rx} ${ry} 0 ${lgt} 1 ${f(t1[0])} ${f(t1[1])} Z`} fill={col} stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" />)
  })
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '6px 0 12px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ flexShrink: 0, overflow: 'visible' }} role="img" aria-label="3D pie chart">
        <defs>
          <filter id={`${uid}b`} x="-20%" y="-50%" width="140%" height="220%"><feGaussianBlur stdDeviation="3.2" /></filter>
          <radialGradient id={`${uid}g`} cx="0.34" cy="0.22" r="0.85">
            <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.06" />
            <stop offset="1" stopColor="#000" stopOpacity="0.16" />
          </radialGradient>
        </defs>
        <ellipse cx={cx} cy={cy + dep + 7} rx={rx * 0.94} ry={ry * 0.7} fill="#000" opacity="0.30" filter={`url(#${uid}b)`} />
        {walls}{tops}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${uid}g)`} />
      </svg>
      <div style={{ flex: 1 }}>
        {keys.map((k, i) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', marginBottom: '3px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: (cols && cols[k]) || PIE_FALLBACK[i % PIE_FALLBACK.length], display: 'inline-block' }} />
            <span style={{ flex: 1, color: 'var(--text-dim)' }}>{k}</span>
            <span style={{ color: 'var(--text-faint)' }}>{obj[k]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Make the weight bars self-explanatory: "W1 (5 min)".
function wLabelBars(k) { const lab = wLabel(k); return lab ? `${k} (${lab})` : k }

export default function Data() {
  const { state } = useApp()
  const [chartType, setChartType] = useState('bar')
  const tasks = state.tasks.filter(t => !t.completed)
  const tot = tasks.length || 1
  const bkCounts = {}, laCounts = {}, wCounts = {}
  tasks.forEach(t => {
    bkCounts[t.bucket] = (bkCounts[t.bucket] || 0) + 1
    laCounts[t.lifeArea || 'Other'] = (laCounts[t.lifeArea || 'Other'] || 0) + 1
    wCounts[t.weightage || '?'] = (wCounts[t.weightage || '?'] || 0) + 1
  })
  const isPie = chartType === 'pie'

  const toggle = (
    <span>
      <button className={`cal-btn${isPie ? ' cancel' : ' go'}`} style={{ padding: '2px 8px', fontSize: '10px', marginRight: '4px' }} onClick={() => setChartType('bar')}>bars</button>
      <button className={`cal-btn${isPie ? ' go' : ' cancel'}`} style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => setChartType('pie')}>pie</button>
    </span>
  )

  function section(title, obj, cols, uid, labelFn) {
    return (
      <div className="col">
        <div className="col-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="col-name" style={{ color: 'var(--gold)' }}>{title}</div>
          {toggle}
        </div>
        <div className="col-body">
          {isPie ? <Pie obj={obj} cols={cols} tot={tot} uid={uid} /> : <Bars obj={obj} cols={cols} tot={tot} labelFn={labelFn} />}
        </div>
      </div>
    )
  }

  return (
    <div className="wrap">
      {section('By Bucket', bkCounts, B_COL, 'pz1')}
      {section('By Life Area', laCounts, LA_COL, 'pz2')}
      {section('By Weightage', wCounts, W_COL, 'pz3', wLabelBars)}
      <Footer />
    </div>
  )
}
