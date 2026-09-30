import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../store/AppContext'
import { BUCKET_ORDER, HORIZON_OPTS } from '../../constants'
import { arenaNameOf, displayTitle, horizonLabel, shortTitleFrom, wLabel } from '../../utils'

function matches(t, q) {
  if (t.completed) return false
  const hay = [t.title, t.shortTitle, t.bucket, arenaNameOf(t.ch), t.lifeArea].join(' ').toLowerCase()
  return hay.includes(q)
}

function EditPanel({ task, onDone }) {
  const { patchTask } = useApp()
  const [title, setTitle] = useState(task.title)
  const [weight, setWeight] = useState(task.weightage || 'W1')
  const [horizon, setHorizon] = useState(task.timeHorizonType || '')

  async function save() {
    const updates = { weightage: weight, timeHorizonType: horizon || null }
    const nt = title.trim()
    if (nt && nt !== task.title) { updates.title = nt; updates.shortTitle = shortTitleFrom(nt) }
    await patchTask(task.id, updates)
    onDone('✓ Task updated')
  }

  return (
    <div className="sf-panel">
      <input className="sf-field" value={title} onChange={e => setTitle(e.target.value)} />
      <select className="sf-field" value={weight} onChange={e => setWeight(e.target.value)}>
        {['W1', 'W2', 'W3', 'W4', 'W5'].map(w => <option key={w} value={w}>{w} — {wLabel(w)}</option>)}
      </select>
      <select className="sf-field" value={horizon} onChange={e => setHorizon(e.target.value)}>
        {HORIZON_OPTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
      </select>
      <div className="sf-actions">
        <button className="sf-act done" onClick={save}>Save</button>
        <button className="sf-act" onClick={() => onDone(null)}>Cancel</button>
      </div>
    </div>
  )
}

export default function SmartFetchModal() {
  const { state, dispatch, patchTask, showToast } = useApp()
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState(null) // { id, kind: 'edit' | 'reassign' }
  const inputRef = useRef(null)

  useEffect(() => {
    if (state.smartFetchOpen) {
      setQuery('')
      setPanel(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [state.smartFetchOpen])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && state.smartFetchOpen) dispatch({ type: 'TOGGLE_SMART_FETCH' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.smartFetchOpen, dispatch])

  if (!state.smartFetchOpen) return null

  const q = query.trim().toLowerCase()
  // Re-derived on every render, so the list (and the Copy count) is current
  // right after each action.
  const hits = q ? state.tasks.filter(t => matches(t, q)) : null

  function close() { dispatch({ type: 'TOGGLE_SMART_FETCH' }) }
  function openKWM() { close(); dispatch({ type: 'TOGGLE_KWM' }) }

  function after(msg) {
    setPanel(null)
    if (msg) showToast(msg, 'ok', 1800)
  }

  async function closeTask(t) {
    const nowIso = new Date().toISOString()
    await patchTask(t.id, {
      completed: true,
      completedTimestamp: nowIso,
      stateHistory: [...(t.stateHistory || []), { bucket: 'Completed', timestamp: nowIso }],
      transitionCount: (t.transitionCount || 0) + 1,
    })
    after('✓ Closed')
  }

  async function move(t, bucket) {
    if (t.bucket === bucket) return
    await patchTask(t.id, {
      bucket,
      stateHistory: [...(t.stateHistory || []), { bucket, timestamp: new Date().toISOString() }],
      transitionCount: (t.transitionCount || 0) + 1,
    })
    after(`✓ Moved to ${bucket}`)
  }

  function togglePanel(id, kind) {
    setPanel(panel && panel.id === id && panel.kind === kind ? null : { id, kind })
  }

  // Plain-text list from the current search, pasteable into WhatsApp or a text.
  function copyResults() {
    if (!hits || !hits.length) return
    const lines = [query.trim() ? `Tasks — ${query.trim()}:` : 'Tasks:'].concat(hits.map(t => {
      const h = horizonLabel(t.timeHorizonType)
      return `• ${displayTitle(t)}${h ? ` (${h})` : ''}`
    }))
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lines.join('\n')).then(
        () => showToast('Copied — paste it into WhatsApp or a text.', 'ok', 2200),
        () => showToast('Could not copy — select and copy manually.', 'warn', 2500))
    } else {
      showToast('Copy not supported on this browser.', 'warn', 2500)
    }
  }

  return (
    <div className="sf-modal open">
      <div className="sf-box">
        <div className="sf-title">Smart Fetch</div>
        <div className="sf-row">
          <input
            ref={inputRef}
            type="text"
            className="sf-input"
            placeholder="e.g. Dallas, invoice, Dhruv…"
            value={query}
            onChange={e => { setQuery(e.target.value); setPanel(null) }}
          />
          <button className="sf-btn-close" onClick={close}>Close</button>
          <button className="sf-btn-close" onClick={openKWM} title="Manage keyword lists" style={{ marginLeft: '4px' }}>🔑</button>
        </div>
        <div className="sf-results">
          {hits === null && <div className="sf-hint">Type a word or phrase to search your tasks.</div>}
          {hits !== null && hits.length === 0 && (
            <div className="sf-hint">No active tasks found matching <strong>{q}</strong>.</div>
          )}
          {hits !== null && hits.length > 0 && (
            <>
              <div className="sf-count">{hits.length} task{hits.length > 1 ? 's' : ''} found:</div>
              {hits.map(t => {
                const h = horizonLabel(t.timeHorizonType)
                const open = panel && panel.id === t.id ? panel.kind : null
                return (
                  <div key={t.id} className="sf-item">
                    <div className="sf-item-title">{displayTitle(t)}</div>
                    <div className="sf-item-meta">
                      {t.bucket || ''}{t.ch ? ` · ${arenaNameOf(t.ch)}` : ''}{h ? ` · ${h}` : ''}
                    </div>
                    <div className="sf-actions">
                      <button className="sf-act done" onClick={() => closeTask(t)}>✓ Close</button>
                      <button className="sf-act" onClick={() => togglePanel(t.id, 'edit')}>✎ Modify</button>
                      <button className="sf-act" onClick={() => togglePanel(t.id, 'reassign')}>⇄ Reassign</button>
                    </div>
                    {open === 'edit' && <EditPanel task={t} onDone={after} />}
                    {open === 'reassign' && (
                      <div className="sf-panel">
                        <div className="sf-chips">
                          {BUCKET_ORDER.map(b => t.bucket === b
                            ? <span key={b} className="sf-chip cur">{b}</span>
                            : <span key={b} className="sf-chip" onClick={() => move(t, b)}>{b}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <button className="ocr-btn-add" style={{ marginTop: '10px', width: '100%' }} onClick={copyResults}>
                📋 Copy these {hits.length} task{hits.length > 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
