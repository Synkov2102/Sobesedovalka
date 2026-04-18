import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { DragItem } from '../types/playgroundFileExplorer.types'

export function useClearDropTargetWhenNoDrag(
  dragItem: DragItem | null,
  setDropTargetPath: Dispatch<SetStateAction<string | null>>,
): void {
  useEffect(() => {
    if (!dragItem) {
      setDropTargetPath(null)
    }
  }, [dragItem, setDropTargetPath])
}
