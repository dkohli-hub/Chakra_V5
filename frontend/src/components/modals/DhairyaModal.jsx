import React from 'react'
import { useApp } from '../../store/AppContext'

// Rule 18: done / not done / move bucket / move date. One tap updates this task
// and every task in its linkedTasks group together.
export default function DhairyaModal() {
  const { state, dispatch, patchTask, showToast } = useApp()
  const task = state.tasks.find(t => t.id === state.dhairyaId)
  if (!state.dhairyaId || !task) return null

  function close() { dispatch({ type: 'SET_DHAIRYA', payload: null }) }

  const linkedTasks = (task.linkedTasks || [])
    .map(lid => state.tasks.find(x => x.id === lid))
    .filter(Boolean)

  async function resolve(gotDone) {
    const dest = gotDone ? 'Karya' : 'Tyaga'
    const group = [task, ...linkedTasks]
    const nowIso = new Date().toISOString()
    try {
      for (const g of group) {
        await patchTask(g.id, {
          bucket: dest,
          stateHistory: [...(g.stateHistory || []), { bucket: dest, timestamp: nowIso }],
          transitionCount: (g.transitionCount || 0) + 1,
        })
      }
      close()
      showToast((gotDone ? '✓ Moved to Karya' : 'Released to Tyaga') + (group.length > 1 ? ` — ${group.length} linked tasks` : ''), 'ok', 2000)
    } catch {
      showToast('Failed to update task', 'warn')
    }
  }

  function moveBucketOrDate() {
    close()
    dispatch({ type: 'SET_DETAIL', payload: { type: 'task', id: task.id } })
  }

  return (
    <div className="sp-modal" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="fab-panel" id="dhairyaBox">
        <div className="fab-panel-hdr">
          <div className="fab-panel-title">Waiting item</div>
          <div className="fab-panel-close" onClick={close}>✕</div>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '6px', lineHeight: 1.5 }}>{task.title}</div>
        {linkedTasks.length > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '10px' }}>
            Linked: {linkedTasks.map(t => t.title).join(', ')}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="fab-panel-save" style={{ background: 'var(--green,#2E7D32)' }} onClick={() => resolve(true)}>✓ It got done — move to Karya</div>
          <div className="fab-panel-save" style={{ background: 'var(--red,#8B1A1A)' }} onClick={() => resolve(false)}>✕ It did not get done — release to Tyaga</div>
          <div className="fab-panel-save" style={{ background: 'var(--surface3)', color: 'var(--text)' }} onClick={moveBucketOrDate}>↔ Move bucket / date &amp; time</div>
        </div>
      </div>
    </div>
  )
}
