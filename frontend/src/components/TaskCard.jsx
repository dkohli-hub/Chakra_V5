import React from 'react'
import { useApp } from '../store/AppContext'
import { isOD, isTamas, tcol, tborder, heatText, wLabel, horizonLabel, displayTitle } from '../utils'

export default function TaskCard({ task }) {
  const { state, dispatch, patchTask, unlinkTask, showToast } = useApp()

  async function handleToggle(e) {
    e.stopPropagation()
    try {
      const nowTs = new Date().toISOString()
      const newState = !task.completed
      const sh = [...(task.stateHistory || []), { bucket: newState ? 'Completed' : task.bucket, timestamp: nowTs }]
      await patchTask(task.id, {
        completed: newState,
        completedTimestamp: newState ? nowTs : null,
        stateHistory: sh,
        transitionCount: (task.transitionCount || 0) + 1,
      })
    } catch {
      showToast('Failed to update task', 'warn')
    }
  }

  // Category badge — tap to toggle Personal ↔ Picturizze
  async function handleToggleCategory(e) {
    e.stopPropagation()
    const cur = task.category || task.lifeArea || 'Personal'
    const next = cur === 'Picturizze' ? 'Personal' : 'Picturizze'
    try {
      await patchTask(task.id, { category: next, lifeArea: next })
      showToast(`Task moved to ${next}`, 'ok', 1800)
    } catch {
      showToast('Failed to update category', 'warn')
    }
  }

  function openDetail() { dispatch({ type: 'SET_DETAIL', payload: { type: 'task', id: task.id } }) }

  function openDhairya(e) {
    e.stopPropagation()
    dispatch({ type: 'SET_DHAIRYA', payload: task.id })
  }

  async function handleUnlink(e, otherId) {
    e.stopPropagation()
    await unlinkTask(task.id, otherId)
    showToast('Link removed', 'ok', 1400)
  }

  const od = isOD(task)
  const tam = isTamas(task)
  const tc = tcol(task)
  const hLabel = horizonLabel(task.timeHorizonType || task.timeHorizon)
  const catLabel = task.category || task.lifeArea || 'Personal'
  const catIcon = catLabel === 'Picturizze' ? '📸' : '🏠'
  const linked = (task.linkedTasks || [])
    .map(lid => state.tasks.find(x => x.id === lid))
    .filter(Boolean)

  return (
    <div className={`icard${task.completed ? ' done' : ''}${tborder(task)}`} id={`ic-${task.id}`}>
      <input
        type="checkbox"
        className="icheck"
        checked={!!task.completed}
        onChange={handleToggle}
      />
      <div className="ibody" onClick={openDetail}>
        <div className="ititle">{displayTitle(task)}</div>
        <div className="imeta">
          <span className={`iw ${task.weightage || ''}`} title="Weight — how much time this takes">
            {task.weightage || '-'}
            <span style={{ fontSize: '6px', opacity: 0.6, marginLeft: '2px' }}>{wLabel(task.weightage)}</span>
          </span>
          {hLabel && (
            <span className="ith" style={{ color: tc }} title={heatText(task)}>{hLabel}</span>
          )}
          <span className="cat-badge" onClick={handleToggleCategory} title="Tap to change category">
            {catIcon} {catLabel}
          </span>
          {(task.multitask === true || task.multitask === 'Yes') && <span className="mt-badge">🔀 multitask</span>}
          {od && (
            <>
              <span style={{ color: 'var(--red)', fontSize: '15px', fontWeight: 900, lineHeight: 1, verticalAlign: 'middle' }}>★</span>
              <span className="od-badge">OVERDUE</span>
            </>
          )}
          {tam && (
            <span className="od-badge" style={{ background: 'var(--red)', color: '#fff' }} title={`${task.bucket} — untouched 3+ months`}>
              🔥 TAMAS
            </span>
          )}
          {task.bucket === 'Dhairya' && (
            <span className="cat-badge" onClick={openDhairya} title="Waiting on someone — tap for options">⏳ waiting</span>
          )}
          {linked.map(lt => (
            <span key={lt.id} className="cat-badge" title="AI-linked — tap ✕ to remove">
              🔗 {displayTitle(lt).slice(0, 24)}
              <span onClick={e => handleUnlink(e, lt.id)} style={{ marginLeft: '4px', opacity: 0.6 }}>✕</span>
            </span>
          ))}
        </div>
      </div>
      <span
        style={{ color: 'var(--text-faint)', fontSize: '14px', padding: '2px 4px', cursor: 'pointer' }}
        onClick={openDetail}
      >⋯</span>
    </div>
  )
}
