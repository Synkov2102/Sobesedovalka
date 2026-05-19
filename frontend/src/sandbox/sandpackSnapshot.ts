import { normalizeSandpackFilePath } from '../collab/sandpackPaths'
import { readSandpackFileCode } from './sandpackCode'
import {
  listSandpackPathsToRemove,
  mergeSandboxFilesFromSnapshot,
  resolveSandpackLayout,
} from './sandpackResolve'

export type SandpackMutable = {
  files: Record<string, unknown>
  activeFile?: string
  status?: string
  updateFile: (
    path: string,
    content: string,
    shouldUpdatePreview?: boolean,
  ) => void
  deleteFile: (path: string, shouldUpdatePreview?: boolean) => void
  openFile: (path: string) => void
  runSandpack: () => void | Promise<void>
}

export type CollabSnapshotWire = {
  files?: Record<string, string>
  folders?: string[]
}

export type CollabSnapshotHandleResult = {
  merged: Record<string, string>
  explorerPaths: string[]
  syncPaths: string[]
  skippedSandpackApply: boolean
}

const BUNDLER_ACTIVE_STATUSES = new Set(['running', 'done'])

function isBundlerActive(status: string | undefined): boolean {
  return status != null && BUNDLER_ACTIVE_STATUSES.has(status)
}

function triggerRecompile(
  sandpack: SandpackMutable,
  sandpackFiles: Record<string, string>,
  lastTouchedPath: string | undefined,
): void {
  const path =
    lastTouchedPath ??
    normalizeSandpackFilePath(sandpack.activeFile ?? '') ??
    ''
  const content = path ? sandpackFiles[path] : undefined
  if (path && content !== undefined) {
    sandpack.updateFile(path, content, true)
    return
  }
  const fallback = Object.keys(sandpackFiles).sort((a, b) =>
    a.localeCompare(b),
  )[0]
  if (fallback) {
    sandpack.updateFile(fallback, sandpackFiles[fallback], true)
    return
  }
  queueMicrotask(() => {
    void sandpack.runSandpack()
  })
}

/** Синхронизирует файлы Sandpack с merged-снимком (без remount провайдера). */
export function applySandpackSnapshot(
  sandpack: SandpackMutable,
  layout: ReturnType<typeof resolveSandpackLayout>,
  previousSyncedPaths: readonly string[],
): string[] {
  const sandpackFiles = layout.syncFiles
  const nextPaths = Object.keys(sandpackFiles)
  let touched = false
  let lastTouchedPath: string | undefined

  for (const [path, content] of Object.entries(sandpackFiles)) {
    if (readSandpackFileCode(sandpack.files[path]) !== content) {
      sandpack.updateFile(path, content, false)
      touched = true
      lastTouchedPath = path
    }
  }

  const pathsToRemove = listSandpackPathsToRemove(
    previousSyncedPaths,
    nextPaths,
    sandpackFiles,
    layout.custom,
  )
  for (let i = pathsToRemove.length - 1; i >= 0; i -= 1) {
    const path = pathsToRemove[i]
    if (sandpack.files[path]) {
      sandpack.deleteFile(path, false)
      touched = true
      lastTouchedPath = path
    }
  }

  const active = normalizeSandpackFilePath(sandpack.activeFile ?? '')
  if (!sandpackFiles[active]) {
    const first = nextPaths.sort((a, b) => a.localeCompare(b))[0]
    if (first) {
      sandpack.openFile(first)
    }
  }

  const isFirstSync = previousSyncedPaths.length === 0
  if (touched) {
    if (isBundlerActive(sandpack.status)) {
      triggerRecompile(sandpack, sandpackFiles, lastTouchedPath)
    } else {
      queueMicrotask(() => {
        void sandpack.runSandpack()
      })
    }
  } else if (isFirstSync && !isBundlerActive(sandpack.status)) {
    queueMicrotask(() => {
      void sandpack.runSandpack()
    })
  }

  return nextPaths
}

/**
 * Единая обработка `collab-snapshot`: опциональный remount провайдера (кастомный
 * пресет) или инкрементальный apply в уже смонтированный Sandpack.
 */
export function handleCollabSnapshot(args: {
  payload: CollabSnapshotWire
  sandpack: SandpackMutable
  previousSyncedPaths: readonly string[]
  requestProviderBoot?: (merged: Record<string, string>) => boolean
}): CollabSnapshotHandleResult {
  const merged = mergeSandboxFilesFromSnapshot(args.payload.files)
  const layout = resolveSandpackLayout(merged)
  const isFirstSnapshot = args.previousSyncedPaths.length === 0

  if (isFirstSnapshot && args.requestProviderBoot?.(merged)) {
    return {
      merged,
      explorerPaths: layout.explorerPaths,
      syncPaths: Object.keys(layout.syncFiles),
      skippedSandpackApply: true,
    }
  }

  const syncPaths = applySandpackSnapshot(
    args.sandpack,
    layout,
    args.previousSyncedPaths,
  )

  return {
    merged,
    explorerPaths: layout.explorerPaths,
    syncPaths,
    skippedSandpackApply: false,
  }
}
