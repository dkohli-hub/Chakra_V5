import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../store/AppContext'

export default function SaarthiModal() {
  const { state, dispatch, doImport, showToast } = useApp()
  const [text, setText] = useState('')
  const taRef = useRef(null)

  useEffect(() => {
    if (state.saarthiOpen) {
      setText('')
      setTimeout(() => taRef.current?.focus(), 150)
    }
  }, [state.saarthiOpen])

  if (!state.saarthiOpen) return null

  function close() { dispatch({ type: 'TOGGLE_SAARTHI' }) }

  async function process() {
    const raw = text.trim()
    if (!raw) { showToast('⚠ Nothing pasted yet', 'warn'); return }
    const jsonStart = raw.indexOf('{')
    const cleaned = jsonStart > 0 ? raw.slice(jsonStart) : raw
    try {
      const parsed = JSON.parse(cleaned)
      const incoming = Array.isArray(parsed) ? parsed : (parsed.tasks || [])
      if (!incoming.length) { showToast('⚠ No tasks found in pasted JSON', 'warn'); return }
      const result = await doImport(incoming)
      close()
      let msg = '✓ Saarthi sync done'
      if (result.completed_count) msg += ` · ${result.completed_count} marked done`
      if (result.added) msg += ` · ${result.added} new`
      if (result.updated) msg += ` · ${result.updated} updated`
      showToast(msg, 'ok', 4500)
    } catch {
      showToast('⚠ Invalid JSON — check the pasted text', 'warn', 4000)
    }
  }

  return (
    <div className="sp-modal" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="sp-box">
        <div className="sp-title">⟳ Import from Saarthi</div>
        <div className="sp-sub">Copy your JSON from Notes, Email, or WhatsApp — then paste it below and tap Import.</div>
        <textarea
          ref={taRef}
          className="sp-textarea"
          placeholder="Paste your Saarthi JSON here..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="sp-btn-row">
          <button className="sp-btn cancel" onClick={close}>Cancel</button>
          <button className="sp-btn go" onClick={process}>Import ✓</button>
        </div>
      </div>
    </div>
  )
}
