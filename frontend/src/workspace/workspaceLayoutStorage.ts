export const WORKSPACE_LAYOUT_STORAGE_KEY = 'sobesedovalka:workspace-columns'

/** Must match `@media (max-width: …)` in Playground.css for stacked preview. */
export const WORKSPACE_STACKED_MAX_WIDTH_PX = 1100

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
  /** Preview panel width when docked to the right. */
  preview: { min: 240, max: 900 },
  /** Preview panel height when docked to the bottom (max = container minus handle). */
  previewHeight: { min: 36 },
  editor: { min: 200 },
  /** Reserved editor strip in stacked layout (0 = preview may use full height). */
  editorHeightMin: 0,
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
        {
          min: WORKSPACE_COLUMN_LIMITS.previewHeight.min,
          max: 10_000,
        },
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
