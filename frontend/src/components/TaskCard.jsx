import React from 'react'
import { useApp } from '../store/AppContext'
import { isOD, tcol, wLabel } from '../utils'

export default function TaskCard({ task }) {
  const { patchTask, showToast } = useApp()

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

  const od = isOD(task)
  const tc = tcol(task)

  return (
    <div className={`icard${task.completed ? ' done' : ''}${od ? ' od' : ''}`} id={`ic-${task.id}`}>
      <input
        type="checkbox"
        className="icheck"
        checked={task.completed}
        onChange={handleToggle}
      />
      <div className="ibody">
        <div className="ititle">{task.title}</div>
        <div className="imeta">
          {task.weightage && (
            <span className={`iw ${task.weightage}`}>
              {task.weightage}
              <span style={{ fontSize: '6px', opacity: 0.6, marginLeft: '2px' }}>{wLabel(task.weightage)}</span>
            </span>
          )}
          {task.timeHorizon && (
            <span className="ith" style={{ color: tc }}>{task.timeHorizon}</span>
          )}
          {task.lifeArea && <span className="ila">{task.lifeArea}</span>}
          {(task.multitask === true || task.multitask === 'Yes') && <span className="mt-badge">🔀 multitask</span>}
          {od && (
            <>
              <span style={{ color: 'var(--red)', fontSize: '15px', fontWeight: 900, lineHeight: 1, verticalAlign: 'middle' }}>★</span>
              <span className="od-badge">OVERDUE</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
