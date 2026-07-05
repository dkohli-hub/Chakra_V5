import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { KRISHNA_VERSES } from '../constants'

export default function KrishnaMode() {
  const { state, dispatch } = useApp()
  const [verse, setVerse] = useState('')
  const [show, setShow] = useState(false)

  function toggle() {
    const on = !state.krishnaMode
    dispatch({ type: 'SET_KRISHNA', payload: on })
    const v = KRISHNA_VERSES[Math.floor(Math.random() * KRISHNA_VERSES.length)]
    setVerse(v)
    setShow(on)
    if (on) setTimeout(() => setShow(false), 4500)
  }

  return (
    <>
      <button className={`km-badge${state.krishnaMode ? ' on' : ''}`} onClick={toggle}>
        {state.krishnaMode ? '🕉 Krishna Mode' : '🕉 Krishna'}
      </button>
      <div className={`krishna-verse${show ? ' show' : ''}`}>{verse}</div>
    </>
  )
}
