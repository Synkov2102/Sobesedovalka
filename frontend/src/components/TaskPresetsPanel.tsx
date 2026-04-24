import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createTaskPreset,
  deleteTaskPreset,
  fetchTaskPresets,
  startRoomFromPreset,
  updateTaskPreset,
} from '../api/taskPresets'
import { createDefaultPresetFiles } from '../sandbox/defaultFiles'
import type { TaskPreset, TaskPresetFile } from '../types/api.types'

type PresetDraft = {
  title: string
  description: string
  files: TaskPresetFile[]
}

function makeDefaultDraft(): PresetDraft {
  return {
    title: '',
    description: '',
    files: createDefaultPresetFiles(),
  }
}

function presetToDraft(preset: TaskPreset): PresetDraft {
  return {
    title: preset.title,
    description: preset.description,
    files: Object.entries(preset.files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, content]) => ({ path, content })),
  }
}

function cloneDraft(draft: PresetDraft): PresetDraft {
  return {
    title: draft.title,
    description: draft.description,
    files: draft.files.map((file) => ({ ...file })),
  }
}

type DraftEditorProps = {
  draft: PresetDraft
  titleLabel: string
  submitLabel: string
  busy: boolean
  onChange: (draft: PresetDraft) => void
  onSubmit: (event: FormEvent) => void
  onCancel?: () => void
}

function DraftEditor({
  draft,
  titleLabel,
  submitLabel,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: DraftEditorProps) {
  function patch(next: Partial<PresetDraft>) {
    onChange({
      ...draft,
      ...next,
      files: next.files ?? draft.files,
    })
  }

  function patchFile(index: number, next: Partial<TaskPresetFile>) {
    patch({
      files: draft.files.map((file, fileIndex) =>
        fileIndex === index ? { ...file, ...next } : file,
      ),
    })
  }

  function addFile() {
    patch({
      files: [...draft.files, { path: `/NewFile${draft.files.length + 1}.tsx`, content: '' }],
    })
  }

  function removeFile(index: number) {
    patch({ files: draft.files.filter((_, fileIndex) => fileIndex !== index) })
  }

  return (
    <form className="form presetEditor" onSubmit={onSubmit}>
      <label className="form__label" htmlFor={titleLabel}>
        Название пресета
      </label>
      <input
        id={titleLabel}
        className="input"
        value={draft.title}
        onChange={(event) => patch({ title: event.target.value })}
        placeholder="Например: React todo с багом в фильтрации"
        maxLength={120}
        disabled={busy}
      />

      <label className="form__label" htmlFor={`${titleLabel}-description`}>
        Описание
      </label>
      <textarea
        id={`${titleLabel}-description`}
        className="input input--textarea"
        value={draft.description}
        onChange={(event) => patch({ description: event.target.value })}
        placeholder="Кратко опиши задание и ожидаемый результат"
        maxLength={1000}
        disabled={busy}
      />

      <div className="presetEditor__filesHeader">
        <span className="form__label">Файлы пресета</span>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={addFile}
          disabled={busy}
        >
          Добавить файл
        </button>
      </div>

      <div className="presetEditor__files">
        {draft.files.map((file, index) => (
          <div key={`${index}-${file.path}`} className="presetFileCard">
            <div className="presetFileCard__head">
              <label className="form__label" htmlFor={`${titleLabel}-path-${index}`}>
                Путь файла
              </label>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => removeFile(index)}
                disabled={busy || draft.files.length === 1}
              >
                Удалить
              </button>
            </div>
            <input
              id={`${titleLabel}-path-${index}`}
              className="input"
              value={file.path}
              onChange={(event) => patchFile(index, { path: event.target.value })}
              placeholder="/App.tsx"
              maxLength={240}
              disabled={busy}
            />
            <label className="form__label" htmlFor={`${titleLabel}-content-${index}`}>
              Содержимое
            </label>
            <textarea
              id={`${titleLabel}-content-${index}`}
              className="input input--code"
              value={file.content}
              onChange={(event) => patchFile(index, { content: event.target.value })}
              placeholder="Код файла"
              disabled={busy}
            />
          </div>
        ))}
      </div>

      <div className="presetEditor__actions">
        <button
          type="submit"
          className="btn"
          disabled={busy || !draft.title.trim() || draft.files.length === 0}
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Отмена
          </button>
        ) : null}
      </div>
    </form>
  )
}

export function TaskPresetsPanel() {
  const [presets, setPresets] = useState<TaskPreset[]>([])
  const [draft, setDraft] = useState<PresetDraft>(() => makeDefaultDraft())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<PresetDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const data = await fetchTaskPresets()
        if (alive) {
          setPresets(data)
          setError(null)
        }
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить пресеты')
        }
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  const presetCountLabel = useMemo(() => {
    return presets.length === 1 ? '1 пресет' : `${presets.length} пресетов`
  }, [presets.length])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setBusyKey('create')
    setError(null)
    try {
      const created = await createTaskPreset(cloneDraft(draft))
      setPresets((current) => [created, ...current])
      setDraft(makeDefaultDraft())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать пресет')
    } finally {
      setBusyKey(null)
    }
  }

  function beginEdit(preset: TaskPreset) {
    setEditingId(preset.id)
    setEditingDraft(presetToDraft(preset))
    setError(null)
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingId || !editingDraft) {
      return
    }
    setBusyKey(`save:${editingId}`)
    setError(null)
    try {
      const updated = await updateTaskPreset(editingId, cloneDraft(editingDraft))
      setPresets((current) =>
        current.map((preset) => (preset.id === editingId ? updated : preset)),
      )
      setEditingId(null)
      setEditingDraft(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить пресет')
    } finally {
      setBusyKey(null)
    }
  }

  async function onDelete(id: string) {
    const confirmed = window.confirm('Удалить этот пресет?')
    if (!confirmed) {
      return
    }
    setBusyKey(`delete:${id}`)
    setError(null)
    try {
      await deleteTaskPreset(id)
      setPresets((current) => current.filter((preset) => preset.id !== id))
      if (editingId === id) {
        setEditingId(null)
        setEditingDraft(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить пресет')
    } finally {
      setBusyKey(null)
    }
  }

  async function onStartRoom(id: string) {
    setBusyKey(`start:${id}`)
    setError(null)
    try {
      const { roomId } = await startRoomFromPreset(id)
      const next = new URL(window.location.href)
      next.searchParams.set('room', roomId)
      window.location.assign(next.toString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать комнату')
      setBusyKey(null)
    }
  }

  return (
    <section className="panel" aria-label="Task presets">
      <div className="presetPanel__header">
        <div>
          <h2>Пресеты заданий</h2>
          <p className="panel__muted">
            Сохраняй заготовки файлов для собеседований и запускай новую комнату одним кликом.
          </p>
        </div>
        <p className="presetPanel__count">{presetCountLabel}</p>
      </div>

      {error ? <p className="panel__error">{error}</p> : null}

      <div className="presetPanel__grid">
        <div className="presetPanel__column">
          <h3 className="presetPanel__sectionTitle">Создать пресет</h3>
          <DraftEditor
            draft={draft}
            titleLabel="create-preset-title"
            submitLabel="Создать пресет"
            busy={busyKey === 'create'}
            onChange={setDraft}
            onSubmit={onCreate}
          />
        </div>

        <div className="presetPanel__column">
          <h3 className="presetPanel__sectionTitle">Мои пресеты</h3>
          {loading ? (
            <p className="panel__muted">Загружаю пресеты…</p>
          ) : presets.length === 0 ? (
            <p className="panel__muted">
              Пока нет ни одного пресета. Создай первый шаблон в форме создания.
            </p>
          ) : (
            <ul className="list presetList">
              {presets.map((preset) => {
                const isEditing = editingId === preset.id && editingDraft !== null
                const filePaths = Object.keys(preset.files).sort((a, b) =>
                  a.localeCompare(b),
                )
                return (
                  <li key={preset.id} className="list__item presetList__item">
                    {isEditing ? (
                      <div className="presetCard presetCard--editing">
                        <DraftEditor
                          draft={editingDraft}
                          titleLabel={`edit-preset-${preset.id}`}
                          submitLabel="Сохранить"
                          busy={busyKey === `save:${preset.id}`}
                          onChange={setEditingDraft}
                          onSubmit={onSaveEdit}
                          onCancel={() => {
                            setEditingId(null)
                            setEditingDraft(null)
                          }}
                        />
                      </div>
                    ) : (
                      <div className="presetCard">
                        <div className="presetCard__summary">
                          <div className="list__body">
                            <span className="list__title">{preset.title}</span>
                            {preset.description ? (
                              <p className="presetCard__description">
                                {preset.description}
                              </p>
                            ) : null}
                            <p className="presetCard__meta">
                              {filePaths.length} файлов, обновлен{' '}
                              {new Date(preset.updatedAt).toLocaleString()}
                            </p>
                            <div className="presetCard__files">
                              {filePaths.map((path) => (
                                <code key={path} className="presetCard__fileTag">
                                  {path}
                                </code>
                              ))}
                            </div>
                          </div>
                          <div className="presetCard__actions">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => void onStartRoom(preset.id)}
                              disabled={busyKey !== null}
                            >
                              Стартовать комнату
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--small"
                              onClick={() => beginEdit(preset)}
                              disabled={busyKey !== null}
                            >
                              Редактировать
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger btn--small"
                              onClick={() => void onDelete(preset.id)}
                              disabled={busyKey !== null}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
