import type { PreviewConsoleEntry } from './usePreviewConsole'
import './PreviewConsole.css'

export function PreviewConsoleToggle({
  isOpen,
  onToggle,
}: {
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="playground__btn playground__btn--ghost playground__btn--compact"
      aria-pressed={isOpen}
      onClick={onToggle}
    >
      консоль
    </button>
  )
}

export function PreviewConsole({
  entries,
  onClear,
}: {
  entries: PreviewConsoleEntry[]
  onClear: () => void
}) {
  return (
    <div className="playground__previewConsole" aria-label="Консоль превью">
      <div className="playground__previewConsoleHeader">
        <span>Консоль</span>
        <button
          type="button"
          className="playground__btn playground__btn--ghost playground__btn--compact"
          disabled={entries.length === 0}
          onClick={onClear}
        >
          Очистить
        </button>
      </div>
      <div className="playground__previewConsoleBody">
        {entries.length === 0 ? (
          <div className="playground__previewConsoleEmpty">
            В консоли пока пусто
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`playground__previewConsoleLine playground__previewConsoleLine--${entry.level}`}
            >
              <span className="playground__previewConsoleLevel">
                {entry.level}
              </span>
              <span className="playground__previewConsoleText">
                {entry.args.join(' ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
