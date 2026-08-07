import React, { useState } from 'react'
import { useApp } from '../../store/AppContext'
import { parseWeightage, parseMultitask, parseHorizon } from '../../utils'

const _lastSave = { time: 0, text: '' }

export default function FabOverlay() {
  const { state, dispatch, addTask, showToast } = useApp()
  const [text, setText] = useState('')

  if (!state.fabOverlayOpen) return null

  function close() {
    dispatch({ type: 'TOGGLE_FAB_OVERLAY' })
    setText('')
  }

  async function save() {
    const val = text.trim()
    if (!val) return

    // Duplicate guard: same text within 60 seconds
    const now = Date.now()
    if (val.toLowerCase() === _lastSave.text.toLowerCase() && (now - _lastSave.time) < 60000) {
      if (!window.confirm('This looks like a task you just added (within 1 minute). Add anyway?')) return
    }
    _lastSave.time = now
    _lastSave.text = val

    const lines = val.split('\n').map(s => s.trim()).filter(Boolean)
    try {
      const ts = new Date().toISOString()
      const w = parseWeightage(val) || 'W2'
      const mt = parseMultitask(val)
      const th = parseHorizon(val) || 'thisWeek'
      for (let i = 0; i < lines.length; i++) {
        await addTask({
          id: `task_${Date.now()}${i}`,
          title: lines[i],
          bucket: 'Karya',
          ch: 3,
          weightage: w,
          timeHorizonType: th,
          timeHorizon: th,
          lifeArea: null,
          multitask: mt,
          stateHistory: [{ bucket: 'Karya', timestamp: ts }],
          originBucket: 'Karya',
          completed: false,
          entryTimestamp: ts,
          agingDays: 0,
        })
      }
      showToast(`✓ ${lines.length === 1 ? '1 task' : lines.length + ' tasks'} added to Chakra ＋`)
      // Always close overlay first (v6 behavior)
      close()
      // For single task, offer calendar via floating banner
      if (lines.length === 1) {
        dispatch({ type: 'SET_CAL_ASK', payload: { title: lines[0] } })
      }
    } catch {
      showToast('Failed to save task', 'warn')
    }
  }

  return (
    <div className="fab-overlay open" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="fab-panel">
        <div className="fab-panel-hdr">
          <div className="fab-panel-title">Quick Add</div>
          <button className="fab-panel-close" onClick={close}>×</button>
        </div>
        <textarea
          className="fab-panel-ta"
          placeholder="What's on your mind?"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          autoFocus
        />
        <div className="fab-panel-actions">
          <button className="fab-panel-save" onClick={save}>Save to Chakra</button>
          <div className="fab-panel-mic">🎤</div>
        </div>
        <div className="fab-panel-hint">One task per line · Chakra parses weightage & timing</div>
      </div>
    </div>
  )
}
