const PREFIX = '[collab-sync]'

function isCollabSyncLogEnabled(): boolean {
  if (import.meta.env.VITE_COLLAB_SYNC_DEBUG === 'true') {
    return true
  }
  if (import.meta.env.DEV) {
    return true
  }
  try {
    return localStorage.getItem('sobesedovalka:collab-sync-debug') === '1'
  } catch {
    return false
  }
}

/** Метаданные текста без полного дампа в консоль. */
export function collabSyncTextMeta(content: string): {
  len: number
  preview: string
} {
  const normalized = content.replace(/\r\n/g, '\n')
  const preview =
    normalized.length <= 80
      ? normalized
      : `${normalized.slice(0, 80)}…`
  return { len: normalized.length, preview }
}

export function collabSyncLog(
  scope: string,
  event: string,
  detail?: Record<string, unknown>,
): void {
  if (!isCollabSyncLogEnabled()) {
    return
  }
  if (detail !== undefined) {
    console.debug(PREFIX, scope, event, detail)
  } else {
    console.debug(PREFIX, scope, event)
  }
}
