import React from 'react'
import { useApp } from '../store/AppContext'

export default function Toast() {
  const { state } = useApp()
  const { toast } = state
  return (
    <div className={`toast ${toast ? toast.type + ' show' : ''}`}>
      {toast?.msg}
    </div>
  )
}
