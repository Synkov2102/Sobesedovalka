import { useEffect, useState } from 'react'
import { WORKSPACE_STACKED_MAX_WIDTH_PX } from './workspaceLayoutStorage'

const STACKED_QUERY = `(max-width: ${WORKSPACE_STACKED_MAX_WIDTH_PX}px)`

export function isWorkspaceStackedLayout(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.matchMedia(STACKED_QUERY).matches
}

export function useWorkspaceStackedLayout(): boolean {
  const [stacked, setStacked] = useState(isWorkspaceStackedLayout)

  useEffect(() => {
    const mq = window.matchMedia(STACKED_QUERY)
    const onChange = () => setStacked(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return stacked
}
