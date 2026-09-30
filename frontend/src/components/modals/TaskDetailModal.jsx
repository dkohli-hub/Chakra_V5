import React, { useEffect, useState } from 'react'
import { useApp } from '../../store/AppContext'
import TaskCard from '../TaskCard'
import { BUCKET_ORDER, HORIZON_OPTS, GITA } from '../../constants'
import { isTamas, wLabel } from '../../utils'

const SELECT_STYLE = { width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '8px' }
const HOLD = ['Dhairya', 'Vishram', 'Manan', 'Manthan', 'Tyaga', 'Prarabdha']

// Tap a card: complete, deadline, weight, bucket, Save.
function TaskForm({ task, onClose }) {
  const { patchTask, showToast } = useApp()
  const [complete, setComplete] = useState(!!task.completed)
  const [bucket, setBucket] = useState(task.bucket)
  const [weight, setWeight] = useState(task.weightage || 'W2')
  const [horizon, setHorizon] = useState(task.timeHorizonType || '')

  async function save() {
    const nowIso = new Date().toISOString()
    const updates = { completed: complete, weightage: weight, timeHorizonType: horizon || null }
    if (complete && !task.completed) updates.completedTimestamp = nowIso
    if (bucket !== task.bucket) {
      updates.bucket = bucket
      updates.stateHistory = [...(task.stateHistory || []), { bucket, timestamp: nowIso }]
      updates.transitionCount = (task.transitionCount || 0) + 1
    }
    try {
      await patchTask(task.id, updates)
      onClose()
      showToast('✓ Task updated', 'ok', 1600)
    } catch {
      showToast('Failed to update task', 'warn')
    }
  }

  return (
    <>
      <div className="fab-panel-hdr">
        <div className="fab-panel-title">Task</div>
        <div className="fab-panel-close" onClick={onClose}>✕</div>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '10px', lineHeight: 1.5 }}>{task.title}</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px' }}>
        <input type="checkbox" checked={complete} onChange={e => setComplete(e.target.checked)} /> Mark complete
      </label>
      <div className="tag-lbl">Bucket</div>
      <select style={SELECT_STYLE} value={bucket} onChange={e => setBucket(e.target.value)}>
        {BUCKET_ORDER.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      <div className="tag-lbl">Weight</div>
      <select style={SELECT_STYLE} value={weight} onChange={e => setWeight(e.target.value)}>
        {['W1', 'W2', 'W3', 'W4', 'W5'].map(w => <option key={w} value={w}>{w} — {wLabel(w)}</option>)}
      </select>
      <div className="tag-lbl">Deadline</div>
      <select style={SELECT_STYLE} value={horizon} onChange={e => setHorizon(e.target.value)}>
        {HORIZON_OPTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
      </select>
      <div className="fab-panel-actions">
        <div className="fab-panel-save" onClick={save}>Save</div>
      </div>
    </>
  )
}

function Panel({ title, sub, onClose, children }) {
  return (
    <>
      <div className="fab-panel-hdr">
        <div className="fab-panel-title">{title}</div>
        <div className="fab-panel-close" onClick={onClose}>✕</div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '10px' }}>{sub}</div>
      {children}
    </>
  )
}

const EMPTY = { fontSize: '12px', color: 'var(--text-faint)' }

export default function TaskDetailModal() {
  const { state, dispatch } = useApp()
  const { detail, tasks } = state

  function close() { dispatch({ type: 'SET_DETAIL', payload: null }) }

  useEffect(() => {
    if (!detail) return
    const onKey = e => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail])

  if (!detail) return null

  let body = null
  if (detail.type === 'task') {
    const task = tasks.find(t => t.id === detail.id)
    if (!task) return null
    body = <TaskForm key={task.id} task={task} onClose={close} />
  } else if (detail.type === 'tamas') {
    const items = tasks.filter(t => !t.completed).filter(isTamas)
    body = (
      <Panel title="🔥 In Tamas — 3+ months untouched" onClose={close}
        sub="Manan, Manthan, and Vishram tasks that have sat with no move or completion. Mark complete, move bucket, or change date — that's what resets the clock.">
        {items.length ? items.map(t => <TaskCard key={t.id} task={t} />) : <div style={EMPTY}>None right now.</div>}
      </Panel>
    )
  } else if (detail.type === 'aq') {
    const items = tasks.filter(t => !t.completed && HOLD.includes(t.bucket))
    body = (
      <Panel title="Not in your hands" onClose={close}
        sub="Every task currently waiting, resting, or being released — the complement of your Adversity Quotient.">
        {items.length ? items.map(t => <TaskCard key={t.id} task={t} />) : <div style={EMPTY}>Everything active is in your hands right now.</div>}
      </Panel>
    )
  } else if (detail.type === 'cq') {
    const covered = {}
    tasks.forEach(t => { if (t.ch) covered[t.ch] = 1 })
    const missing = GITA.filter(g => !covered[g.ch])
    body = (
      <Panel title="Arenas with no tasks" onClose={close}
        sub={`${missing.length} of 18 arenas have nothing in them right now.`}>
        {missing.length ? missing.map(g => (
          <div key={g.ch} className="icard" style={{ cursor: 'default' }}>
            <div className="ibody">
              <div className="ititle" style={{ color: g.color }}>{g.name}</div>
              <div className="imeta" style={{ fontSize: '10px', color: 'var(--text-faint)' }}>{g.essence}</div>
            </div>
          </div>
        )) : <div style={EMPTY}>All 18 arenas have at least one task.</div>}
      </Panel>
    )
  }

  return (
    <div className="sp-modal" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="fab-panel" id="taskDetailBox">{body}</div>
    </div>
  )
}
