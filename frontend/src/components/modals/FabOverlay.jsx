import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../../store/AppContext'
import { parseWeightage, parseMultitask, parseHorizon } from '../../utils'

const _lastSave = { time: 0, text: '' }

export default function FabOverlay() {
  const { state, dispatch, commitTasks } = useApp()
  const [text, setText] = useState('')
  const taRef = useRef(null)

  useEffect(() => {
    if (state.fabOverlayOpen) setTimeout(() => taRef.current?.focus(), 250)
  }, [state.fabOverlayOpen])

  if (!state.fabOverlayOpen) return null

  function close() {
    dispatch({ type: 'TOGGLE_FAB_OVERLAY' })
    setText('')
  }

  function saveFabQuick() {
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
    close()
    commitTasks(lines, parseWeightage(val) || 'W2', parseMultitask(val), parseHorizon(val) || 'thisWeek', null, false)
  }

  return (
    <div className="fab-overlay open" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="fab-panel">
        <div className="fab-panel-hdr">
          <div className="fab-panel-title">Quick Gather</div>
          <div className="fab-panel-close" onClick={close}>✕</div>
        </div>
        <textarea
          ref={taRef}
          className="fab-panel-ta"
          placeholder="What is on your mind? Voice it. No format needed."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="fab-panel-actions">
          <div className="fab-panel-save" onClick={saveFabQuick}>Save to Chakra™</div>
          <div className="fab-panel-mic">🎤</div>
        </div>
        <div className="fab-panel-hint">Advanced users: include W3, Q3, ITC in your text</div>
      </div>
    </div>
  )
}
