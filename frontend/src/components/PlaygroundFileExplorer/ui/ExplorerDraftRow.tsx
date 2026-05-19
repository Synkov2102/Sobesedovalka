import {
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useDraftInputFocus } from '../hooks/useDraftInputFocus'
import type { ExplorerDraft } from '../types/playgroundFileExplorer.types'

type ExplorerDraftRowProps = {
  depth: number
  draft: ExplorerDraft
  setDraft: Dispatch<SetStateAction<ExplorerDraft | null>>
  commitDraft: () => void
  cancelDraft: () => void
  FileTypeIcon: (props: { filePath: string }) => ReactNode
}

export function ExplorerDraftRow({
  depth,
  draft,
  setDraft,
  commitDraft,
  cancelDraft,
  FileTypeIcon,
}: ExplorerDraftRowProps) {
  const editorInputRef = useRef<HTMLInputElement | null>(null)
  const draftSelectKeyRef = useRef<string | null>(null)
  useDraftInputFocus(draft, editorInputRef, draftSelectKeyRef)

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
