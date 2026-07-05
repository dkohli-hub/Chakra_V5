import React, { useState } from 'react'
import { useApp } from '../store/AppContext'

export default function Login() {
  const { doLogin } = useApp()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!userId || !password) return
    setLoading(true)
    setError('')
    try {
      await doLogin(userId.trim().toLowerCase(), password)
    } catch {
      setError('Incorrect ID or password.')
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleSubmit(e)
  }

  return (
    <div className="login-overlay">
      <div className="login-box">
        <div className="login-logo">Chakra™</div>
        <div className="login-sub">Your mind, structured.</div>
        <input
          type="text"
          className="login-input"
          placeholder="User ID"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          onKeyDown={handleKey}
          autoComplete="username"
          autoCapitalize="none"
        />
        <input
          type="password"
          className="login-input"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKey}
          autoComplete="current-password"
        />
        <button className="login-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Entering...' : 'Enter Chakra'}
        </button>
        <div className="login-error">{error}</div>
      </div>
    </div>
  )
}
