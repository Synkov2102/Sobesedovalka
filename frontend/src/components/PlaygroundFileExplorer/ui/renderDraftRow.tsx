import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react'
import type { ExplorerDraft } from '../types/playgroundFileExplorer.types'

export function renderDraftRow({
  depth,
  draft,
  editorInputRef,
  setDraft,
  commitDraft,
  cancelDraft,
  FileTypeIcon,
}: {
  depth: number
  draft: ExplorerDraft
  editorInputRef: RefObject<HTMLInputElement | null>
  setDraft: Dispatch<SetStateAction<ExplorerDraft | null>>
  commitDraft: () => void
  cancelDraft: () => void
  FileTypeIcon: (props: { filePath: string }) => ReactNode
}) {
  function handleDraftValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft((prev) => (prev ? { ...prev, value: e.target.value } : prev))
  }

  function handleDraftKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft()
    }
    if (e.key === 'Escape') {
      cancelDraft()
    }
  }

  return (
    <div
      className="playground__treeRow playground__treeRow--draft"
      style={{ paddingLeft: `${depth * 16 + 12}px` }}
    >
      {draft.kind === 'folder' ? (
        <span className="playground__treeIcon">{'>'}</span>
      ) : (
        <FileTypeIcon filePath={`/${draft.value || 'NewFile.tsx'}`} />
      )}
      <input
        ref={editorInputRef}
        className="playground__input playground__input--tree"
        value={draft.value}
        onChange={handleDraftValueChange}
        onKeyDown={handleDraftKeyDown}
        placeholder={
          draft.mode === 'create'
            ? draft.kind === 'file'
              ? 'Widget.tsx or ui/Button'
              : 'components/ui'
            : draft.kind === 'file'
              ? 'Widget.tsx'
              : 'components'
        }
        spellCheck={false}
        autoFocus
      />
    </div>
  )
}

