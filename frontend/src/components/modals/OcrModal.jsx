import React, { useState, useEffect } from 'react'
import { useApp } from '../../store/AppContext'

export default function OcrModal({ onCommit }) {
  const { state, dispatch, showToast } = useApp()
  const lines = state.ocrLines
  const [checked, setChecked] = useState([])

  useEffect(() => {
    if (lines) setChecked(lines.map(() => true))
  }, [lines])

  if (!lines) return null

  function toggle(i) {
    setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  function add() {
    const selected = lines.filter((_, i) => checked[i])
    if (!selected.length) { close(); return }
    onCommit(selected)
    close()
    showToast(`✓ ${selected.length} task${selected.length > 1 ? 's' : ''} added from scan`, 'ok', 3000)
  }

  function close() { dispatch({ type: 'SET_OCR_LINES', payload: null }) }

  return (
    <div className="ocr-modal open">
      <div className="ocr-box">
        <div className="ocr-title">Scanned Text</div>
        <div className="ocr-sub">Select the lines you want to add as tasks in Chakra.</div>
        <div className="ocr-list">
          {lines.map((line, i) => (
            <div key={i} className="ocr-row">
              <input
                type="checkbox"
                className="ocr-cb"
                id={`ocrcb${i}`}
                checked={checked[i] ?? true}
                onChange={() => toggle(i)}
              />
              <label className="ocr-label" htmlFor={`ocrcb${i}`}>{line}</label>
            </div>
          ))}
        </div>
        <div className="ocr-btns">
          <button className="ocr-btn-add" onClick={add}>✓ Add Selected to Chakra</button>
          <button className="ocr-btn-cancel" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
