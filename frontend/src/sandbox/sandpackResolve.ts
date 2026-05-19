import { normalizeSandpackFilePath } from '../collab/sandpackPaths'
import type { SandpackProviderFiles } from './sandpackCode'
import {
  DEFAULT_SANDBOX_APP,
  DEFAULT_SANDBOX_FILES,
  DEFAULT_SANDBOX_INDEX_HTML,
  SANDPACK_BOOTSTRAP_FILES,
  sanitizeKnownSandboxFileContent,
} from './defaultFiles'

/** Infra из template `vite-react-ts` — в standard-режиме не синхронизируем и не удаляем. */
const SANDPACK_INFRA_PATHS = new Set(
  Object.keys(DEFAULT_SANDBOX_FILES).filter(
    (path) => path !== '/App.tsx' && path !== '/styles.css',
  ),
)

const DEFAULT_SANDPACK_PROVIDER_FILES: SandpackProviderFiles =
  Object.fromEntries(
    Object.entries(DEFAULT_SANDBOX_FILES).map(([path, code]) => [
      path,
      { code },
    ]),
  )

export type SandpackLayoutResolution = {
  custom: boolean
  syncFiles: Record<string, string>
  explorerPaths: string[]
}

/** Mongo/API → полный Vite-шаблон с переопределениями комнаты/пресета. */
export function mergeSandboxFiles(
  stored: Record<string, string>,
): Record<string, string> {
  const merged = { ...DEFAULT_SANDBOX_FILES }
  for (const [path, content] of Object.entries(stored)) {
    const normalized = normalizeSandpackFilePath(path)
    if (!normalized) {
      continue
    }
    merged[normalized] = sanitizeKnownSandboxFileContent(normalized, content)
  }
  return merged
}

export function mergeSandboxFilesFromSnapshot(
  raw: unknown,
): Record<string, string> {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SANDBOX_FILES }
  }

  const stored: Record<string, string> = {}
  for (const [path, content] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (typeof content !== 'string') {
      continue
    }
    const normalized = normalizeSandpackFilePath(path)
    if (normalized) {
      stored[normalized] = content
    }
  }
  return mergeSandboxFiles(stored)
}

/** Пресет/комната с путями вне стандартного Vite-шаблона или с кастомной infra. */
export function isCustomSandpackLayout(
  merged: Record<string, string>,
): boolean {
  for (const [path, content] of Object.entries(merged)) {
    if (!Object.hasOwn(DEFAULT_SANDBOX_FILES, path)) {
      return true
    }
    if (
      SANDPACK_INFRA_PATHS.has(path) &&
      content !== DEFAULT_SANDBOX_FILES[path]
    ) {
      return true
    }
  }
  return false
}

function buildSandpackSyncFiles(
  merged: Record<string, string>,
  custom: boolean,
): Record<string, string> {
  const out: Record<string, string> = custom
    ? {}
    : { ...SANDPACK_BOOTSTRAP_FILES }

  for (const [path, content] of Object.entries(merged)) {
    if (!custom && SANDPACK_INFRA_PATHS.has(path)) {
      continue
    }
    out[path] = sanitizeKnownSandboxFileContent(path, content)
  }

  return custom ? ensureSandboxEntryPoints(out) : out
}

function ensureSandboxEntryPoints(
  files: Record<string, string>,
): Record<string, string> {
  const out = { ...files }

  const srcMain = out['/src/main.tsx']?.trim()
    ? '/src/main.tsx'
    : out['/src/main.jsx']?.trim()
      ? '/src/main.jsx'
      : null

  if (srcMain && out['/index.html'] === DEFAULT_SANDBOX_INDEX_HTML) {
    out['/index.html'] = DEFAULT_SANDBOX_INDEX_HTML.replace(
      'src="/index.tsx"',
      `src="${srcMain}"`,
    )
  }

  const srcAppPath = out['/src/App.tsx']?.trim()
    ? '/src/App.tsx'
    : out['/src/App.jsx']?.trim()
      ? '/src/App.jsx'
      : null
  if (
    srcAppPath &&
    (!out['/App.tsx']?.trim() || out['/App.tsx'] === DEFAULT_SANDBOX_APP)
  ) {
    out['/App.tsx'] = `export { default } from ".${srcAppPath}";\n`
  }

  return out
}

/** Один проход: custom-флаг, sync-файлы для Sandpack, пути проводника. */
export function resolveSandpackLayout(
  merged: Record<string, string>,
): SandpackLayoutResolution {
  const custom = isCustomSandpackLayout(merged)
  return {
    custom,
    syncFiles: buildSandpackSyncFiles(merged, custom),
    explorerPaths: Object.keys(merged).sort((a, b) => a.localeCompare(b)),
  }
}

/** Пути для проводника: полный шаблон комнаты (Mongo), не только bootstrap в Sandpack. */
export function explorerFilePaths(merged: Record<string, string>): string[] {
  return Object.keys(merged).sort((a, b) => a.localeCompare(b))
}

/** Какие файлы реально отдавать в Sandpack (standard = bootstrap + custom, иначе весь merged). */
export function filesForSandpackSync(
  merged: Record<string, string>,
): Record<string, string> {
  return resolveSandpackLayout(merged).syncFiles
}

export function listSandpackPathsToRemove(
  previousSynced: readonly string[],
  nextSynced: readonly string[],
  merged: Record<string, string>,
  custom = isCustomSandpackLayout(merged),
): string[] {
  const nextSet = new Set(nextSynced)
  const protectInfra = !custom
  return previousSynced.filter(
    (path) =>
      !nextSet.has(path) && (!protectInfra || !SANDPACK_INFRA_PATHS.has(path)),
  )
}

export function toSandpackProviderFiles(
  files: Record<string, string>,
): SandpackProviderFiles {
  return Object.fromEntries(
    Object.entries(files).map(([path, code]) => [path, { code }]),
  )
}

function standardProviderFiles(
  syncFiles: Record<string, string>,
): SandpackProviderFiles {
  if (Object.keys(syncFiles).length === 0) {
    return DEFAULT_SANDPACK_PROVIDER_FILES
  }
  return toSandpackProviderFiles({ ...DEFAULT_SANDBOX_FILES, ...syncFiles })
}

/** Файлы для `SandpackProvider`: полный Vite-шаблон или весь кастомный пресет. */
export function sandpackProviderFilesFromMerged(
  merged: Record<string, string>,
): SandpackProviderFiles {
  const { custom, syncFiles } = resolveSandpackLayout(merged)
  if (custom) {
    return toSandpackProviderFiles(syncFiles)
  }
  return standardProviderFiles(syncFiles)
}

export {
  sandpackFilesSignature,
  type SandpackProviderFiles,
} from './sandpackCode'

export function getSandpackProviderFilesFromStored(
  stored?: Record<string, string>,
): SandpackProviderFiles {
  return sandpackProviderFilesFromMerged(mergeSandboxFiles(stored ?? {}))
}

/** Сохранение пресета: те же файлы, что уйдут в Sandpack при следующей загрузке. */
export function filesForPresetPersist(
  stored: Record<string, string>,
): Record<string, string> {
  return filesForSandpackSync(mergeSandboxFiles(stored))
}
