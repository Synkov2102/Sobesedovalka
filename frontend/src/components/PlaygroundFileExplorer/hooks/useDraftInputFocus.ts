import { useEffect, type RefObject } from 'react'
import type { ExplorerDraft } from '../types/playgroundFileExplorer.types'

export function useDraftInputFocus(
  draft: ExplorerDraft | null,
  editorInputRef: RefObject<HTMLInputElement | null>,
  draftSelectKeyRef: RefObject<string | null>,
): void {
  useEffect(() => {
    if (!draft) {
      draftSelectKeyRef.current = null
      return
    }

    editorInputRef.current?.focus()
    const selectionKey =
      draft.mode === 'rename'
        ? `${draft.mode}:${draft.kind}:${draft.path}`
        : `${draft.mode}:${draft.kind}:${draft.parentPath}`

    if (draftSelectKeyRef.current !== selectionKey) {
      editorInputRef.current?.select()
      draftSelectKeyRef.current = selectionKey
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref objects are stable
  }, [draft])
}
