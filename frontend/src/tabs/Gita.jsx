import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import TaskCard from '../components/TaskCard'
import { GITA } from '../constants'

export default function Gita() {
  const { state } = useApp()
  const [openCh, setOpenCh] = useState(null)
  const tasks = state.tasks.filter(t => !t.completed)

  return (
    <>
      <div className="gita-grid">
        {GITA.map(ch => {
          const cnt = tasks.filter(t => t.ch === ch.ch).length
          const isOpen = openCh === ch.ch
          return (
            <div
              key={ch.ch}
              className={`gita-tile${isOpen ? ' open' : ''}`}
              onClick={() => setOpenCh(isOpen ? null : ch.ch)}
            >
              <div className="gita-ch">Ch {ch.ch}</div>
              <div className="gita-name" style={{ color: ch.color }}>{ch.name}</div>
              <div className="gita-essence">{ch.essence}</div>
              <div className="gita-count">{cnt} task{cnt !== 1 ? 's' : ''}</div>
              {isOpen && (
                <div className="gita-expanded">
                  <div className="gita-teaching">{ch.teaching}</div>
                  {cnt > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      {tasks.filter(t => t.ch === ch.ch).map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="page-footer">
        <div className="footer-disc">
          These are signals, not certainties. The quality and accuracy of what Chakra reads depends entirely on what you have put in.
        </div>
      </div>
    </>
  )
}
