import React, { useState, useEffect } from 'react'
import { useApp } from '../store/AppContext'
import TaskCard from '../components/TaskCard'
import Footer from '../components/Footer'
import { formatDate, computeBattery } from '../utils'

export default function TodayBattery() {
  const { state, dispatch } = useApp()
  const [drillKey, setDrillKey] = useState(null)
  const { active, tamasT, odT, todayT, weekT, nwT, laterT, charge, drain, chCol, drainLabel } = computeBattery(state.tasks)
  const total = active.length

  useEffect(() => {
    if (!drillKey) return
    const t = setTimeout(() => {
      const el = document.getElementById('drillPanel')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 60)
    return () => clearTimeout(t)
  }, [drillKey])

  const crossed = odT.length + tamasT.length
  const msg = crossed === 0 ? 'Clean field, DK. Nothing draining your battery today.'
    : crossed === 1 ? 'One item needs you. Clear it and your battery recovers.'
    : `${crossed} items have crossed their time. Each one is a quiet drain. Clear one today.`

  // Proportional segments. Order = visual top→bottom; Tamas last, at the bottom.
  const batH = 320
  function seg(count, label, bg, key, titleTxt, onClick) {
    if (!count) return null
    const h = Math.max(52, Math.round((count / Math.max(total, 1)) * batH))
    return (
      <div key={key} className="bat-seg" style={{ height: h, background: bg }} title={titleTxt}
        onClick={onClick || (() => setDrillKey(key))}>
        <div className="bat-seg-inner">
          <div className="bat-seg-count">{count}</div>
          <div className="bat-seg-label">{label}</div>
        </div>
      </div>
    )
  }

  const drillMap = { today: todayT, week: weekT, nextweek: nwT, later: laterT, overdue: odT, all: active }
  const drillLbl = { today: 'Today', week: 'This week', nextweek: 'Next week', later: 'Later', overdue: '★ Overdue', all: 'All active' }
  const list = drillKey ? drillMap[drillKey] || [] : []

  return (
    <div className="bat-wrap">
      <div className="bat-date">{formatDate()}</div>
      <div className="bat-msg">{msg}</div>
      <div className="bat-nub" />
      <div className="bat-outer">
        {seg(laterT.length, 'Later', '#2A5F8A', 'later', 'Due later than 2 weeks out')}
        {seg(nwT.length, 'Next week', '#1A5F52', 'nextweek', 'Due within the next 2 weeks')}
        {seg(weekT.length, 'This week', '#7A5200', 'week', 'Due within 7 days')}
        {seg(todayT.length, 'Today', '#1A6B20', 'today', 'Due today')}
        {seg(odT.length, '★ Overdue', '#8B1A1A', 'overdue', 'Past deadline, within 30% grace')}
        {seg(tamasT.length, '🔥 Tamas', '#5A0F0F', 'tamas', 'Already in Tamas — 3+ months untouched',
          () => dispatch({ type: 'SET_DETAIL', payload: { type: 'tamas' } }))}
        {total === 0 && <div className="bat-empty">Empty field — add tasks in Gather</div>}
      </div>
      <div className="bat-charge-wrap">
        <div className="bat-charge-row">
          <span title="How much of your day is unclaimed by overdue and Tamas drain">Charge</span>
          <span style={{ fontWeight: 700, color: chCol }}>{charge}%</span>
        </div>
        <div className="bat-charge-bar">
          <div className="bat-charge-fill" style={{ width: `${charge}%`, background: chCol }} />
        </div>
        <div className="bat-charge-lbl" style={{ color: drain > 25 ? 'var(--red)' : 'var(--text-faint)' }}>{drainLabel}</div>
      </div>
      <div className="bat-total" onClick={() => setDrillKey('all')} title="Every active, incomplete task">
        <div className="bat-total-num">{total}</div>
        <div className="bat-total-sub">active</div>
      </div>
      <div className="bat-pills">
        {todayT.length > 0 && (
          <button className="bat-pill" style={{ background: '#1A6B20' }} onClick={() => setDrillKey('today')}>Today {todayT.length}</button>
        )}
        {weekT.length > 0 && (
          <button className="bat-pill" style={{ background: '#7A5200' }} onClick={() => setDrillKey('week')}>This week {weekT.length}</button>
        )}
      </div>
      <button className="bat-add-btn" onClick={() => dispatch({ type: 'SET_TAB', payload: 'gather' })}>＋ Add Tasks</button>
      <button className="saarthi-btn" onClick={() => dispatch({ type: 'TOGGLE_SAARTHI' })}>⟳ Import from Saarthi</button>
      {drillKey && list.length > 0 && (
        <div className="bat-drill open" id="drillPanel">
          <div className="bat-drill-hdr">
            <div className="bat-drill-title">{drillLbl[drillKey]} ({list.length})</div>
            <button className="bat-drill-close" onClick={() => setDrillKey(null)}>×</button>
          </div>
          {list.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      )}
      <Footer />
    </div>
  )
}

