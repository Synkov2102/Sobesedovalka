export const WORKSPACE_LAYOUT_STORAGE_KEY = 'sobesedovalka:workspace-columns'

export type WorkspaceColumnLayout = {
  files: number
  preview: number
}

export const WORKSPACE_COLUMN_DEFAULTS: WorkspaceColumnLayout = {
  files: 260,
  preview: 420,
}

export const WORKSPACE_COLUMN_LIMITS = {
  files: { min: 160, max: 520 },
  preview: { min: 240, max: 900 },
  editor: { min: 200 },
  handle: 5,
} as const

export function loadWorkspaceColumnLayout(): WorkspaceColumnLayout {
  try {
    const raw = localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY)
    if (!raw) {
      return { ...WORKSPACE_COLUMN_DEFAULTS }
    }
    const parsed = JSON.parse(raw) as Partial<WorkspaceColumnLayout>
    return {
      files: clampLayoutValue(
        parsed.files,
        WORKSPACE_COLUMN_DEFAULTS.files,
        WORKSPACE_COLUMN_LIMITS.files,
      ),
      preview: clampLayoutValue(
        parsed.preview,
        WORKSPACE_COLUMN_DEFAULTS.preview,
        WORKSPACE_COLUMN_LIMITS.preview,
      ),
    }
  } catch {
    return { ...WORKSPACE_COLUMN_DEFAULTS }
  }
}

export function saveWorkspaceColumnLayout(layout: WorkspaceColumnLayout): void {
  try {
    localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    /* ignore quota / private mode */
  }
}

function clampLayoutValue(
  value: unknown,
  fallback: number,
  limits: { min: number; max: number },
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.round(Math.min(limits.max, Math.max(limits.min, value)))
}
