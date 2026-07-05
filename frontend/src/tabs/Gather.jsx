import React, { useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import TaskCard from '../components/TaskCard'
import { parseLLM, scanOCR } from '../api'
import { parseWeightage, parseMultitask, parseHorizon, suggestCalendar } from '../utils'
import { BUCKETS, CAL_KEYWORDS } from '../constants'

const LIFE_AREAS = [
  'Personal/Family', 'Work/Employment', 'Picturizze',
  'Health / Body', 'Finance / Wealth', 'Learning / Growth', 'Other'
]

const HORIZONS = ['today', 'thisWeek', 'nextWeek', 'thisMonth', 'later']
const H_LABEL = { today: 'Today', thisWeek: 'This Week', nextWeek: 'Next Week', thisMonth: 'Next Month', later: 'Later' }

export default function Gather() {
  const { state, dispatch, addTask, showToast } = useApp()
  const fileRef = useRef()
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [bucket, setBucket] = useState('Karya')
  const [weightage, setWeightage] = useState('W2')
  const [horizon, setHorizon] = useState('today')
  const [lifeArea, setLifeArea] = useState('')
  const [multitask, setMultitask] = useState('No')
  const [tagsOpen, setTagsOpen] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [llmLoading, setLlmLoading] = useState(false)

  const recent = state.tasks.filter(t => !t.completed).slice(-6).reverse()

  async function handleOcr(e) {
    const file = e.target.files[0]
    if (!file) return
    setOcrLoading(true)
    try {
      const reader = new FileReader()
      reader.onload = async ev => {
        const b64 = ev.target.result.split(',')[1]
        const text = await scanOCR(b64)
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
        dispatch({ type: 'SET_OCR_LINES', payload: lines })
        dispatch({ type: 'TOGGLE_SAARTHI' })
      }
      reader.readAsDataURL(file)
    } catch {
      showToast('OCR failed', 'error')
    } finally {
      setOcrLoading(false)
      e.target.value = ''
    }
  }

  async function handleSmartParse() {
    if (!title.trim()) return
    setLlmLoading(true)
    try {
      const prompt = `Extract task metadata from this text. Return JSON with fields: bucket (one of: ${BUCKETS.map(b => b.key).join(', ')}), weightage (W1-W5), timeHorizonType (today/thisWeek/nextWeek/later), lifeArea (optional), multitask (Yes/No).\n\nText: "${title}"`
      const result = await parseLLM(prompt)
      try {
        const j = JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || '{}')
        if (j.bucket && BUCKETS.some(b => b.key === j.bucket)) setBucket(j.bucket)
        if (j.weightage) setWeightage(j.weightage)
        if (j.timeHorizonType && HORIZONS.includes(j.timeHorizonType)) setHorizon(j.timeHorizonType)
        if (j.lifeArea) setLifeArea(j.lifeArea)
        if (j.multitask) setMultitask(j.multitask)
        setTagsOpen(true)
        showToast('Smart parsed ✓', 'ok')
      } catch {
        showToast('Could not parse response', 'warn')
      }
    } catch {
      showToast('LLM call failed', 'warn')
    } finally {
      setLlmLoading(false)
    }
  }

  async function handleAdd() {
    if (!title.trim()) return
    const parsed = parseWeightage(title) || weightage
    const parsedM = parseMultitask(title) || multitask
    const parsedH = parseHorizon(title) || horizon
    const task = {
      title: title.trim(),
      bucket,
      weightage: parsed,
      timeHorizonType: parsedH,
      lifeArea,
      multitask: parsedM,
      ch: null,
      context: context.trim() || null
    }
    try {
      await addTask(task)
      const calSlot = suggestCalendar(title, CAL_KEYWORDS)
      if (calSlot) {
        dispatch({ type: 'SET_CAL_ASK', payload: { title: title.trim(), slot: calSlot } })
      }
      setTitle('')
      setContext('')
      setWeightage('W2')
      setHorizon('today')
      setLifeArea('')
      setMultitask('No')
      setBucket('Karya')
      setTagsOpen(false)
      showToast('Added to Chakra ✓', 'ok')
    } catch {
      showToast('Failed to add task', 'warn')
    }
  }

  return (
    <div className="gather-wrap">
      <div className="gather-card">
        <div className="gather-prompt">What is the task?</div>
        <textarea
          className="gather-textarea"
          placeholder="One task per line — type or paste from photo"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd() }}
          rows={3}
        />

        <button
          className="smart-parse-btn"
          onClick={handleSmartParse}
          disabled={llmLoading || !title.trim()}
        >
          {llmLoading ? 'Parsing…' : '⚡ Smart Parse'}
        </button>

        <div className="img-section">
          <div className="img-section-lbl">📷 Upload photo or screenshot</div>
          <label className="img-upload-btn">
            {ocrLoading ? '⟳ Scanning…' : '📷 Choose image'}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleOcr} />
          </label>
          <textarea
            className="img-commentary"
            placeholder="Context (optional): duration, multitask, urgency…"
            value={context}
            onChange={e => setContext(e.target.value)}
            rows={2}
          />
        </div>

        <div className="tags-toggle" onClick={() => setTagsOpen(o => !o)}>
          <span className="tags-toggle-lbl">Tags &amp; Options</span>
          <span className={`tags-chevron${tagsOpen ? ' open' : ''}`}>▼</span>
        </div>
        <div className={`tags-body${tagsOpen ? ' open' : ''}`}>
          <div className="tag-group">
            <div className="tag-lbl">Bucket</div>
            <div className="tag-opts">
              {BUCKETS.map(b => (
                <span key={b.key} className={`tag-chip${bucket === b.key ? ' sel' : ''}`} onClick={() => setBucket(b.key)}>{b.key}</span>
              ))}
            </div>
          </div>
          <div className="tag-group">
            <div className="tag-lbl">Weightage</div>
            <div className="tag-opts">
              {['W1','W2','W3','W4','W5'].map((w, i) => (
                <span key={w} className={`tag-chip${weightage === w ? ' sel' : ''}`} onClick={() => setWeightage(w)}>{w} · {['5m','30m','1h','½d','Day'][i]}</span>
              ))}
            </div>
          </div>
          <div className="tag-group">
            <div className="tag-lbl">Time Horizon</div>
            <div className="tag-opts">
              {HORIZONS.map(h => (
                <span key={h} className={`tag-chip${horizon === h ? ' sel' : ''}`} onClick={() => setHorizon(h)}>{H_LABEL[h]}</span>
              ))}
            </div>
          </div>
          <div className="tag-group">
            <div className="tag-lbl">Life Area</div>
            <div className="tag-opts">
              {LIFE_AREAS.map(la => (
                <span key={la} className={`tag-chip${lifeArea === la ? ' sel' : ''}`} onClick={() => setLifeArea(lifeArea === la ? '' : la)}>{la}</span>
              ))}
            </div>
          </div>
          <div className="tag-group">
            <div className="tag-lbl">Multitaskable?</div>
            <div className="tag-opts">
              <span className={`tag-chip${multitask === 'Yes' ? ' sel' : ''}`} onClick={() => setMultitask('Yes')}>Yes — driving/walk</span>
              <span className={`tag-chip${multitask === 'No' ? ' sel' : ''}`} onClick={() => setMultitask('No')}>No — full focus</span>
            </div>
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="recent-section">
          <div className="recent-hdr">
            <span className="recent-lbl">Recent Entries</span>
            <span className="recent-count">{state.tasks.filter(t => !t.completed).length} active</span>
          </div>
          {recent.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      <button
        className={`gather-fab${title.trim() ? ' visible' : ''}`}
        onClick={handleAdd}
      >
        Add to Chakra ＋
      </button>
    </div>
  )
}
