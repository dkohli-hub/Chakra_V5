import React, { useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import TaskCard from '../components/TaskCard'
import { parseLLM, scanOCR } from '../api'
import { parseWeightage, parseMultitask, parseHorizon, suggestCalendar } from '../utils'
import { BUCKETS, CAL_KEYWORDS } from '../constants'

const LIFE_AREAS = [
  'Self / Soul', 'Health / Body', 'Relationships', 'Career / Work',
  'Finance / Wealth', 'Learning / Growth', 'Family / Home', 'Society / World'
]

const HORIZONS = ['today', 'thisWeek', 'nextWeek', 'later']
const H_LABEL = { today: 'Today', thisWeek: 'This Week', nextWeek: 'Next Week', later: 'Later' }

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
      dispatch({ type: 'SHOW_TOAST', payload: { msg: 'OCR failed', type: 'error' } })
    } finally {
      setOcrLoading(false)
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
        dispatch({ type: 'SHOW_TOAST', payload: { msg: 'Smart parsed', type: 'ok' } })
      } catch {
        dispatch({ type: 'SHOW_TOAST', payload: { msg: 'Could not parse response', type: 'error' } })
      }
    } catch {
      dispatch({ type: 'SHOW_TOAST', payload: { msg: 'LLM call failed', type: 'error' } })
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
      showToast('Added to Chakra', 'ok')
    } catch {
      showToast('Failed to add task', 'error')
    }
  }

  return (
    <div className="wrap">
      <div className="gather-section">
        <div className="gather-prompt">What is the task?</div>
        <textarea
          className="gather-ta"
          placeholder="Type a task, thought, or intention…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd() }}
          rows={3}
        />
        <div className="gather-row-btns">
          <button className="btn-ghost" onClick={handleSmartParse} disabled={llmLoading || !title.trim()}>
            {llmLoading ? 'Parsing…' : '⚡ Smart Parse'}
          </button>
        </div>
      </div>

      <div className="img-section">
        <div className="img-section-lbl">Scan from image</div>
        <div className="img-upload-area" onClick={() => fileRef.current.click()}>
          {ocrLoading ? 'Scanning…' : '📷 Tap to upload image'}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOcr} />
        {context !== undefined && (
          <textarea
            className="img-commentary"
            placeholder="Add context (optional)…"
            value={context}
            onChange={e => setContext(e.target.value)}
            rows={2}
          />
        )}
      </div>

      <div className="tags-section">
        <div className="tags-hdr" onClick={() => setTagsOpen(o => !o)}>
          <span className="tags-hdr-txt">Tags &amp; Options</span>
          <span className="tags-toggle">{tagsOpen ? '▲' : '▼'}</span>
        </div>
        {tagsOpen && (
          <div className="tags-body">
            <div className="tag-row">
              <div className="tag-lbl">Bucket</div>
              <div className="tag-chips">
                {BUCKETS.map(b => (
                  <div key={b.key} className={`tag-chip${bucket === b.key ? ' sel' : ''}`} onClick={() => setBucket(b.key)}>{b.key}</div>
                ))}
              </div>
            </div>
            <div className="tag-row">
              <div className="tag-lbl">Weightage</div>
              <div className="tag-chips">
                {['W1', 'W2', 'W3', 'W4', 'W5'].map(w => (
                  <div key={w} className={`tag-chip${weightage === w ? ' sel' : ''}`} onClick={() => setWeightage(w)}>{w}</div>
                ))}
              </div>
            </div>
            <div className="tag-row">
              <div className="tag-lbl">Time Horizon</div>
              <div className="tag-chips">
                {HORIZONS.map(h => (
                  <div key={h} className={`tag-chip${horizon === h ? ' sel' : ''}`} onClick={() => setHorizon(h)}>{H_LABEL[h]}</div>
                ))}
              </div>
            </div>
            <div className="tag-row">
              <div className="tag-lbl">Life Area</div>
              <div className="tag-chips">
                {LIFE_AREAS.map(la => (
                  <div key={la} className={`tag-chip${lifeArea === la ? ' sel' : ''}`} onClick={() => setLifeArea(lifeArea === la ? '' : la)}>{la}</div>
                ))}
              </div>
            </div>
            <div className="tag-row">
              <div className="tag-lbl">Multitask</div>
              <div className="tag-chips">
                {['Yes', 'No'].map(m => (
                  <div key={m} className={`tag-chip${multitask === m ? ' sel' : ''}`} onClick={() => setMultitask(m)}>{m}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="recent-section">
          <div className="recent-lbl">Recent Entries</div>
          {recent.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      <div className="gather-fab" onClick={handleAdd}>Add to Chakra ＋</div>
    </div>
  )
}
