import React, { useState, useRef } from 'react'
import { useApp } from '../store/AppContext'
import TaskCard from '../components/TaskCard'
import { BUCKETS } from '../constants'

function BucketCol({ bk, tasks, colRef }) {
  const [open, setOpen] = useState(false)
  const items = tasks.filter(t => t.bucket === bk.key)
  return (
    <div className={`col ${bk.css}${open ? '' : ' collapsed'}`} id={`bk-${bk.key}`} ref={colRef}>
      <div className="col-hdr" onClick={() => setOpen(!open)}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="col-name">{bk.name}</div>
            <div className="col-count">{items.length}</div>
          </div>
          <div className="col-sub">{bk.sub}</div>
        </div>
        <span className="chevron">&#9654;</span>
      </div>
      <div className="col-body">
        {items.map(t => <TaskCard key={t.id} task={t} />)}
      </div>
    </div>
  )
}

export default function Karma() {
  const { state } = useApp()
  const tasks = state.tasks.filter(t => !t.completed)
  const total = tasks.length || 1
  const colRefs = useRef({})

  function scrollToBk(key) {
    const el = colRefs.current[key]
    if (!el) return
    el.classList.remove('collapsed')
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  return (
    <>
      <div className="vessels-wrap">
        <div className="vessels-grid">
          {BUCKETS.map(bk => {
            const cnt = tasks.filter(t => t.bucket === bk.key).length
            const pct = Math.min((cnt / total) * 200, 95)
            return (
              <div key={bk.key} className="vessel" onClick={() => scrollToBk(bk.key)}>
                <div className="vessel-count" style={{ color: bk.col }}>{cnt}</div>
                <div className="vessel-cup">
                  <div className="vessel-fill" style={{ height: `${pct}%`, background: bk.col, opacity: 0.7 }} />
                </div>
                <div className="vessel-name" style={{ color: bk.col }}>{bk.key}</div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="wrap">
        {BUCKETS.map(bk => (
          <BucketCol
            key={bk.key}
            bk={bk}
            tasks={tasks}
            colRef={el => { colRefs.current[bk.key] = el }}
          />
        ))}
        <div className="page-footer">
          <div className="footer-disc">
            These are signals, not certainties. The quality and accuracy of what Chakra reads depends entirely on what you have put in.
          </div>
        </div>
      </div>
    </>
  )
}
