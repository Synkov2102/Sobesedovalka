import { useEffect, type Dispatch, type SetStateAction } from 'react'

export function useCopiedPathReset(
  copiedPath: string | null,
  setCopiedPath: Dispatch<SetStateAction<string | null>>,
): void {
  useEffect(() => {
    if (!copiedPath) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedPath((prev) => (prev === copiedPath ? null : prev))
    }, 1500)

    return () => window.clearTimeout(timeoutId)
  }, [copiedPath, setCopiedPath])
}
