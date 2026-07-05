import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import TaskCard from '../components/TaskCard'
import { isOD, formatDate, computeCharge } from '../utils'

function computeSegments(tasks) {
  const active = tasks.filter(t => !t.completed)
  const now2 = new Date(); now2.setHours(0, 0, 0, 0)
  const yr = now2.getFullYear()
  const horizonDeadline = {
    today: new Date(now2),
    thisWeek: new Date(now2.getTime() + 7 * 86400000),
    nextWeek: new Date(now2.getTime() + 14 * 86400000),
    thisMonth: new Date(now2.getTime() + 30 * 86400000),
    Q3: new Date(yr, 8, 30),
    Q4: new Date(yr, 11, 31),
    thisYear: new Date(yr, 11, 31),
    '1year': new Date(yr + 1, 11, 31),
    '2years': new Date(yr + 2, 11, 31)
  }
  function od(t) {
    if (!t.timeHorizonType || t.timeHorizonType === 'parkingLot') return false
    const deadline = horizonDeadline[t.timeHorizonType]
    if (!deadline) return false
    const entry = t.entryTimestamp ? new Date(t.entryTimestamp) : null
    if (!entry) return false
    if (t.timeHorizonType === 'today') {
      const ed = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate())
      return ed < now2
    }
    if (t.timeHorizonType === 'thisWeek') {
      const ed = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate())
      return (now2 - ed) > 7 * 86400000
    }
    if (t.timeHorizonType === 'nextWeek') {
      const ed = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate())
      return (now2 - ed) > 14 * 86400000
    }
    if (t.timeHorizonType === 'thisMonth') {
      const ed = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate())
      return (now2 - ed) > 30 * 86400000
    }
    return now2 > deadline
  }
  const odT = active.filter(od)
  const odIds = new Set(odT.map(t => t.id))
  const todayT = active.filter(t => t.timeHorizonType === 'today' && !odIds.has(t.id))
  const weekT  = active.filter(t => t.timeHorizonType === 'thisWeek' && !odIds.has(t.id))
  const nwT    = active.filter(t => t.timeHorizonType === 'nextWeek' && !odIds.has(t.id))
  const laterT = active.filter(t => !odIds.has(t.id) && t.timeHorizonType !== 'today' && t.timeHorizonType !== 'thisWeek' && t.timeHorizonType !== 'nextWeek')
  return { odT, todayT, weekT, nwT, laterT }
}

export default function TodayBattery() {
  const { state, dispatch, showToast } = useApp()
  const [drillKey, setDrillKey] = useState(null)
  const { tasks } = state

  const active = tasks.filter(t => !t.completed)
  const total = active.length
  const { odT, todayT, weekT, nwT, laterT } = computeSegments(tasks)
  const { charge, drain, chCol, drainLabel } = computeCharge(tasks)
  const dateStr = formatDate()

  const odAll = odT.length
  const msg = odAll === 0
    ? 'Clean field, DK. No overdue items draining your battery today.'
    : odAll === 1
    ? 'One item has crossed its time. Clear it and your battery recovers.'
    : `${odAll} items have crossed their time. Each one is a quiet drain. Clear one today.`

  const batH = 320
  function renderSeg(count, label, bg, key) {
    if (!count) return null
    const h = Math.max(52, Math.round((count / Math.max(total, 1)) * batH))
    return (
      <div
        key={key}
        className="bat-seg"
        style={{ height: h, background: bg }}
        onClick={() => setDrillKey(drillKey === key ? null : key)}
      >
        <div className="bat-seg-inner">
          <div className="bat-seg-count">{count}</div>
          <div className="bat-seg-label">{label}</div>
        </div>
      </div>
    )
  }

  const drillMap = { today: todayT, week: weekT, nextweek: nwT, later: laterT, overdue: odT, all: active }
  const drillLbl = { today: 'Today', week: 'This week', nextweek: 'Next week', later: 'Later', overdue: '★ Overdue', all: 'All active' }

  return (
    <div className="bat-wrap">
      <div className="bat-date">{dateStr}</div>
      <div className="bat-msg">{msg}</div>
      <div className="bat-nub" />
      <div className="bat-outer">
        {renderSeg(laterT.length, 'Later', '#2A5F8A', 'later')}
        {renderSeg(nwT.length, 'Next week', '#1A5F52', 'nextweek')}
        {renderSeg(weekT.length, 'This week', '#7A5200', 'week')}
        {renderSeg(todayT.length, 'Today', '#1A6B20', 'today')}
        {renderSeg(odT.length, '★ Overdue', '#8B1A1A', 'overdue')}
        {total === 0 && <div className="bat-empty">Empty field — add tasks in Gather</div>}
      </div>
      <div className="bat-charge-wrap">
        <div className="bat-charge-row">
          <span>Charge</span>
          <span style={{ fontWeight: 700, color: chCol }}>{charge}%</span>
        </div>
        <div className="bat-charge-bar">
          <div className="bat-charge-fill" style={{ width: `${charge}%`, background: chCol }} />
        </div>
        <div className="bat-charge-lbl" style={{ color: drain > 25 ? 'var(--red)' : 'var(--text-faint)' }}>
          {drainLabel}
        </div>
      </div>
      <div className="bat-total" onClick={() => setDrillKey(drillKey === 'all' ? null : 'all')}>
        <div className="bat-total-num">{total}</div>
        <div className="bat-total-sub">active</div>
      </div>
      <div className="bat-pills">
        {odAll > 0 && (
          <button className="bat-pill" style={{ background: '#8B1A1A' }} onClick={() => setDrillKey('overdue')}>
            ★ {odAll} overdue
          </button>
        )}
        {todayT.length > 0 && (
          <button className="bat-pill" style={{ background: '#1A6B20' }} onClick={() => setDrillKey('today')}>
            Today {todayT.length}
          </button>
        )}
        {weekT.length > 0 && (
          <button className="bat-pill" style={{ background: '#7A5200' }} onClick={() => setDrillKey('week')}>
            This week {weekT.length}
          </button>
        )}
      </div>
      <button className="bat-add-btn" onClick={() => dispatch({ type: 'SET_TAB', payload: 'gather' })}>
        ＋ Add Tasks
      </button>
      <button className="saarthi-btn" onClick={() => dispatch({ type: 'TOGGLE_SAARTHI' })}>
        ⟳ Import from Saarthi
      </button>
      {drillKey && drillMap[drillKey]?.length > 0 && (
        <div className="bat-drill open">
          <div className="bat-drill-hdr">
            <div className="bat-drill-title">{drillLbl[drillKey]} ({drillMap[drillKey].length})</div>
            <button className="bat-drill-close" onClick={() => setDrillKey(null)}>×</button>
          </div>
          {drillMap[drillKey].map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      )}
      <div className="page-footer">
        <div className="footer-disc">
          These are signals, not certainties. The quality and accuracy of what Chakra reads depends entirely on what you have put in.
        </div>
      </div>
    </div>
  )
}
