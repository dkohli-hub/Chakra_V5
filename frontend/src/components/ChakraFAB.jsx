import React, { useRef, useState } from 'react'
import { useApp } from '../store/AppContext'

export default function ChakraFAB() {
  const { dispatch } = useApp()
  const wrapRef = useRef(null)

  function openFab() {
    if (wrapRef.current) {
      wrapRef.current.classList.add('spinning')
      setTimeout(() => wrapRef.current?.classList.remove('spinning'), 400)
    }
    dispatch({ type: 'TOGGLE_FAB_OVERLAY' })
  }

  function openSmartFetch() {
    dispatch({ type: 'TOGGLE_SMART_FETCH' })
  }

  return (
    <div className="chakra-fab-row">
      <div className="sf-fab-inline" onClick={openSmartFetch} title="Smart Fetch">
        🔍
      </div>
      <div className="chakra-fab-wrap" ref={wrapRef}>
        <div className="chakra-fab-img" onClick={openFab} title="Quick add">
          <img src="/logo.png" alt="Chakra" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        </div>
      </div>
    </div>
  )
}
