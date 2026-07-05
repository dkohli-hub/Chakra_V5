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
      <div className="chakra-fab-wrap" ref={wrapRef}>
        <div className="chakra-fab-img" onClick={openFab} title="Quick add">
          🕉
        </div>
      </div>
      <div className="sf-fab-inline" onClick={openSmartFetch} title="Smart Fetch">
        🔍
      </div>
    </div>
  )
}
