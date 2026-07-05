import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import TaskCard from '../components/TaskCard'
import { TIME_GROUPS } from '../constants'

function ColGroup({ group, tasks }) {
  const [open, setOpen] = useState(false)
  const items = tasks.filter(t => group.types.includes(t.timeHorizonType))
  if (!items.length) return null
  return (
    <div className={`col ${group.cls}${open ? '' : ' collapsed'}`}>
      <div className="col-hdr" onClick={() => setOpen(!open)}>
        <div>
          <div className="col-name">{group.label} <span style={{ fontSize: '14px' }}>({items.length})</span></div>
          <div className="col-sub">{group.sub}</div>
        </div>
        <span className="chevron">&#9654;</span>
      </div>
      <div className="col-body">
        {items.map(t => <TaskCard key={t.id} task={t} />)}
      </div>
    </div>
  )
}

export default function Time() {
  const { state } = useApp()
  const tasks = state.tasks.filter(t => !t.completed)
  return (
    <div className="wrap">
      {TIME_GROUPS.map(g => <ColGroup key={g.key} group={g} tasks={tasks} />)}
      <div className="page-footer">
        <div className="footer-disc">
          These are signals, not certainties. The quality and accuracy of what Chakra reads depends entirely on what you have put in.
        </div>
      </div>
    </div>
  )
}
