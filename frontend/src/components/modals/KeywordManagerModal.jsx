import React, { useState, useEffect } from 'react'
import { useApp } from '../../store/AppContext'

const SECTIONS = [
  { cat: 'picturizze', label: '📸 Picturizze keywords' },
  { cat: 'personal',   label: '🏠 Personal keywords' },
]

export default function KeywordManagerModal() {
  const { state, dispatch, setKeywords, showToast } = useApp()
  const [inputs, setInputs] = useState({ picturizze: '', personal: '' })

  useEffect(() => {
    if (!state.kwmOpen) setInputs({ picturizze: '', personal: '' })
  }, [state.kwmOpen])

  if (!state.kwmOpen) return null

  function close() { dispatch({ type: 'TOGGLE_KWM' }) }

  function handleAdd(cat) {
    const val = inputs[cat].trim().toLowerCase()
    if (!val) { showToast('Enter a word first.', 'warn', 1500); return }
    const list = state.calKeywords[cat] || []
    if (list.includes(val)) { showToast('Already in list.', 'warn', 1500); return }
    setKeywords(cat, [...list, val])
    setInputs(prev => ({ ...prev, [cat]: '' }))
    showToast(`'${val}' added to ${cat} list.`, 'ok', 1800)
  }

  function handleDelete(cat, idx) {
    const list = [...(state.calKeywords[cat] || [])]
    list.splice(idx, 1)
    setKeywords(cat, list)
    showToast('Keyword removed.', 'ok', 1500)
  }

  return (
    <div className="kwm-modal open" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="kwm-box">
        <div className="kwm-title">Keyword Manager</div>
        <div className="kwm-sub">Words that guide calendar routing. Edit anytime — changes are saved instantly.</div>

        {SECTIONS.map(({ cat, label }) => (
          <div key={cat} className="kwm-section">
            <div className="kwm-section-label">{label}</div>
            <div className="kwm-tags">
              {(state.calKeywords[cat] || []).length === 0
                ? <span style={{ fontSize: '11px', color: '#777' }}>No keywords yet.</span>
                : (state.calKeywords[cat] || []).map((kw, i) => (
                  <div key={i} className="kwm-tag">
                    {kw}
                    <button className="kwm-tag-del" onClick={() => handleDelete(cat, i)}>×</button>
                  </div>
                ))
              }
            </div>
            <div className="kwm-add-row">
              <input
                type="text"
                className="kwm-input"
                placeholder="Add a word…"
                value={inputs[cat]}
                onChange={e => setInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd(cat)}
              />
              <button className="kwm-add-btn" onClick={() => handleAdd(cat)}>+ Add</button>
            </div>
          </div>
        ))}

        <button className="kwm-close-btn" onClick={close}>Done</button>
      </div>
    </div>
  )
}
