import React, { useRef, useState } from 'react'
import { useApp } from '../../store/AppContext'
import { parseWeightage, parseMultitask, parseHorizon } from '../../utils'

export default function FabOverlay() {
  const { state, dispatch, addTask, showToast } = useApp()
  const [text, setText] = useState('')
  const [calShow, setCalShow] = useState(false)
  const [lastTitle, setLastTitle] = useState('')

  if (!state.fabOverlayOpen) return null

  function close() {
    dispatch({ type: 'TOGGLE_FAB_OVERLAY' })
    setText('')
    setCalShow(false)
  }

  async function save() {
    const val = text.trim()
    if (!val) return
    const lines = val.split('\n').map(s => s.trim()).filter(Boolean)
    try {
      const now = new Date().toISOString()
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
          stateHistory: [{ bucket: 'Karya', timestamp: now }],
          originBucket: 'Karya',
          completed: false,
          entryTimestamp: now,
          agingDays: 0,
        })
      }
      showToast(`✓ ${lines.length === 1 ? '1 task' : lines.length + ' tasks'} added to Chakra ＋`)
      if (lines.length === 1) {
        setLastTitle(lines[0])
        setCalShow(true)
      } else {
        setText('')
        close()
      }
    } catch {
      showToast('Failed to save task', 'warn')
    }
  }

  function openCal() {
    close()
    dispatch({ type: 'SET_CAL_MODAL', payload: { open: true, taskTitle: lastTitle } })
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
          placeholder="Type tasks here — one per line..."
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
        {calShow && (
          <div className="fab-panel-cal show">
            <div className="fab-panel-cal-title">✓ Saved — Add to Calendar?</div>
            <div className="cal-ask-btns">
              <button className="cal-btn go" onClick={openCal}>Yes — Schedule It</button>
              <button className="cal-btn cancel" onClick={close}>Not now</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
