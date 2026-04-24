import { type FormEvent, useState } from 'react'
import { useAuth } from './AuthContext'

type Mode = 'login' | 'register'

export function AuthScreen() {
  const { login, register, authError, clearAuthError } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [loginField, setLoginField] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    clearAuthError()
    setLocalError(null)
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    const l = loginField.trim()
    if (!l || !password || busy) {
      return
    }
    setBusy(true)
    setLocalError(null)
    clearAuthError()
    try {
      await login(l, password)
    } catch {
      // authError set in context
    } finally {
      setBusy(false)
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault()
    if (!password.trim() || busy) {
      return
    }
    const eTrim = email.trim()
    const pTrim = phone.trim()
    if (!eTrim && !pTrim) {
      setLocalError('Укажите почту или номер телефона')
      return
    }
    if (password.length < 8) {
      setLocalError('Пароль не короче 8 символов')
      return
    }
    setBusy(true)
    setLocalError(null)
    clearAuthError()
    try {
      await register({ email, phone, password })
    } catch {
      // authError in context
    } finally {
      setBusy(false)
    }
  }

  const displayError = localError ?? authError

  return (
    <div className="app authScreen">
      <header className="app__header">
        <p className="app__eyebrow">Live coding interview</p>
        <h1>Вход</h1>
        <p className="app__lead">
          Войдите или зарегистрируйтесь по почте и/или номеру телефона и паролю.
          Подтверждение почты и телефона пока не требуется.
        </p>
      </header>

      <div className="authScreen__tabs" role="tablist" aria-label="Режим">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={`app__navBtn${mode === 'login' ? ' app__navBtn--active' : ''}`}
          onClick={() => switchMode('login')}
        >
          Вход
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={`app__navBtn${mode === 'register' ? ' app__navBtn--active' : ''}`}
          onClick={() => switchMode('register')}
        >
          Регистрация
        </button>
      </div>

      <section className="panel authScreen__panel" aria-label={mode === 'login' ? 'Вход' : 'Регистрация'}>
        {displayError ? (
          <p className="panel__error" role="alert">
            {displayError}
          </p>
        ) : null}

        {mode === 'login' ? (
          <form className="form" onSubmit={(ev) => void onLogin(ev)}>
            <label className="form__label" htmlFor="auth-login">
              Почта или телефон
            </label>
            <input
              id="auth-login"
              className="input"
              value={loginField}
              onChange={(ev) => setLoginField(ev.target.value)}
              autoComplete="username"
              maxLength={320}
            />
            <label className="form__label" htmlFor="auth-password">
              Пароль
            </label>
            <input
              id="auth-password"
              type="password"
              className="input"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              autoComplete="current-password"
              maxLength={128}
            />
            <button
              type="submit"
              className="btn"
              disabled={
                busy || !loginField.trim() || !password
              }
            >
              Войти
            </button>
          </form>
        ) : (
          <form className="form" onSubmit={(ev) => void onRegister(ev)}>
            <label className="form__label" htmlFor="auth-email">
              Почта (необязательно)
            </label>
            <input
              id="auth-email"
              type="text"
              className="input"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              autoComplete="email"
              maxLength={320}
            />
            <label className="form__label" htmlFor="auth-phone">
              Телефон (необязательно)
            </label>
            <input
              id="auth-phone"
              type="text"
              className="input"
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              autoComplete="tel"
              maxLength={64}
            />
            <p className="panel__muted authScreen__hint">
              Нужно заполнить хотя бы одно из двух полей выше.
            </p>
            <label className="form__label" htmlFor="auth-reg-password">
              Пароль (мин. 8 символов)
            </label>
            <input
              id="auth-reg-password"
              type="password"
              className="input"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              autoComplete="new-password"
              maxLength={128}
            />
            <button
              type="submit"
              className="btn"
              disabled={busy || !password.trim()}
            >
              Зарегистрироваться
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
