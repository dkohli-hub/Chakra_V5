import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../store/AppContext'

export default function SmartFetchModal() {
  const { state, dispatch } = useApp()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (state.smartFetchOpen) {
      setQuery('')
      setResults(null)
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

  function search(q) {
    setQuery(q)
    if (!q.trim()) { setResults(null); return }
    const hits = state.tasks.filter(t => {
      if (t.completed) return false
      const hay = [t.title, t.bucket, t.lifeArea, String(t.ch || '')].join(' ').toLowerCase()
      return hay.includes(q.toLowerCase())
    })
    setResults(hits)
  }

  function close() { dispatch({ type: 'TOGGLE_SMART_FETCH' }) }

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
            onChange={e => search(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search(query)}
          />
          <button className="sf-btn-close" onClick={close}>Close</button>
        </div>
        <div className="sf-results">
          {results === null && <div className="sf-hint">Type a word or phrase to search your tasks.</div>}
          {results !== null && results.length === 0 && (
            <div className="sf-hint">No active tasks found matching <strong>{query}</strong>.</div>
          )}
          {results !== null && results.length > 0 && (
            <>
              <div className="sf-count">{results.length} task{results.length > 1 ? 's' : ''} found:</div>
              {results.map(t => (
                <div key={t.id} className="sf-item">
                  <div className="sf-item-title">{t.title}</div>
                  <div className="sf-item-meta">{t.bucket}{t.ch ? ` · Ch ${t.ch}` : ''}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
