import { Suspense, lazy, useState, type FormEvent } from 'react'
import { useAuth } from './auth/AuthContext'
import { AuthScreen } from './auth/AuthScreen'
import './App.css'
import { useBackendDemo } from './hooks/useBackendDemo'
import type { AuthUser, MainTab } from './types/api.types'

const Playground = lazy(async () => {
  const m = await import('./components/Playground')
  return { default: m.Playground }
})

type AppMainProps = {
  user: AuthUser
  logout: () => void
}

function AppMain({ user, logout }: AppMainProps) {
  const [mainTab, setMainTab] = useState<MainTab>('playground')
  const {
    health,
    healthError,
    tasks,
    tasksError,
    title,
    setTitle,
    busy,
    refreshHealth,
    handleAdd,
    handleDelete,
  } = useBackendDemo()

  function onAdd(e: FormEvent) {
    void handleAdd(e)
  }

  const accountLabel =
    user.email ?? user.phone ?? user.id.slice(0, 8)

  return (
    <div className={mainTab === 'playground' ? 'app app--sandbox' : 'app'}>
      <header className="app__header">
        <p className="app__eyebrow">Live coding interview</p>
        <h1>Full-stack scaffold</h1>
        <p className="app__lead">
          React host → <code>/api</code> proxy → NestJS. Includes a{' '}
          <strong>multi-file React (Vite + TS) sandbox</strong> with live
          preview and a small REST demo. Extend per the interviewer’s prompt.
        </p>
        <p className="app__account">
          <span className="app__accountLabel">{accountLabel}</span>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => logout()}
          >
            Выйти
          </button>
        </p>
      </header>

      <nav className="app__nav" aria-label="Primary">
        <button
          type="button"
          className={`app__navBtn${mainTab === 'playground' ? ' app__navBtn--active' : ''}`}
          aria-current={mainTab === 'playground' ? 'page' : undefined}
          onClick={() => setMainTab('playground')}
        >
          React sandbox
        </button>
        <button
          type="button"
          className={`app__navBtn${mainTab === 'api' ? ' app__navBtn--active' : ''}`}
          aria-current={mainTab === 'api' ? 'page' : undefined}
          onClick={() => setMainTab('api')}
        >
          API &amp; tasks
        </button>
      </nav>

      {mainTab === 'playground' ? (
        <section className="panel panel--wide" aria-label="React sandbox">
          <h2>React sandbox</h2>
          <div className="panel__sandboxBody">
            <Suspense
              fallback={<p className="panel__muted">Loading editor…</p>}
            >
              <Playground />
            </Suspense>
          </div>
        </section>
      ) : (
        <>
          <section className="panel" aria-label="API status">
            <h2>Backend status</h2>
            {healthError ? (
              <p className="panel__error">{healthError}</p>
            ) : health ? (
              <p className="panel__ok">
                <span className="dot dot--ok" aria-hidden />
                <span>
                  <strong className="panel__strong">{health.service}</strong> —
                  OK
                </span>
              </p>
            ) : (
              <p className="panel__muted">Checking…</p>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void refreshHealth()}
            >
              Refresh status
            </button>
          </section>

          <section className="panel" aria-label="Tasks">
            <h2>Tasks (CRUD demo)</h2>
            <form className="form" onSubmit={onAdd}>
              <label className="form__label" htmlFor="task-title">
                Title
              </label>
              <div className="form__row">
                <input
                  id="task-title"
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Implement filter by title…"
                  autoComplete="off"
                  maxLength={500}
                />
                <button
                  type="submit"
                  className="btn"
                  disabled={busy || !title.trim()}
                >
                  Add
                </button>
              </div>
            </form>
            {tasksError ? (
              <p className="panel__error">{tasksError}</p>
            ) : tasks.length === 0 ? (
              <p className="panel__muted">
                No tasks yet — add one to verify the flow.
              </p>
            ) : (
              <ul className="list">
                {tasks.map((task) => (
                  <li key={task.id} className="list__item">
                    <div className="list__body">
                      <span className="list__title">{task.title}</span>
                      <time className="list__time" dateTime={task.createdAt}>
                        {new Date(task.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={() => void handleDelete(task.id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {mainTab !== 'playground' ? (
        <footer className="app__footer">
          <p>
            See <code>README.md</code> for a pre-interview checklist and common
            extension ideas.
          </p>
        </footer>
      ) : null}
    </div>
  )
}

function App() {
  const { user, ready, logout } = useAuth()

  if (!ready) {
    return (
      <div className="app">
        <p className="panel__muted">Загрузка сессии…</p>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return <AppMain user={user} logout={logout} />
}

export default App
