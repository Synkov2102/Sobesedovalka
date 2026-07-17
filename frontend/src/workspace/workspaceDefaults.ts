import {
  DEFAULT_SANDBOX_APP,
  DEFAULT_SANDBOX_FILES,
  DEFAULT_SANDBOX_INDEX,
  DEFAULT_SANDBOX_INDEX_HTML,
  DEFAULT_SANDBOX_PACKAGE_JSON,
  DEFAULT_SANDBOX_STYLES,
  DEFAULT_SANDBOX_TSCONFIG,
  DEFAULT_SANDBOX_TSCONFIG_NODE,
  DEFAULT_SANDBOX_VITE_CONFIG,
  DEFAULT_SANDBOX_VITE_ENV,
  sanitizeKnownSandboxFileContent,
} from '../sandbox/defaultFiles'
import { normalizeWorkspacePath } from './workspacePaths'

export const DEFAULT_WORKSPACE_APP = DEFAULT_SANDBOX_APP
export const DEFAULT_WORKSPACE_INDEX = DEFAULT_SANDBOX_INDEX
export const DEFAULT_WORKSPACE_INDEX_HTML = DEFAULT_SANDBOX_INDEX_HTML
export const DEFAULT_WORKSPACE_PACKAGE_JSON = DEFAULT_SANDBOX_PACKAGE_JSON
export const DEFAULT_WORKSPACE_STYLES = DEFAULT_SANDBOX_STYLES
export const DEFAULT_WORKSPACE_TSCONFIG = DEFAULT_SANDBOX_TSCONFIG
export const DEFAULT_WORKSPACE_TSCONFIG_NODE = DEFAULT_SANDBOX_TSCONFIG_NODE
export const DEFAULT_WORKSPACE_VITE_CONFIG = DEFAULT_SANDBOX_VITE_CONFIG
export const DEFAULT_WORKSPACE_VITE_ENV = DEFAULT_SANDBOX_VITE_ENV

export const DEFAULT_WORKSPACE_FILES: Record<string, string> = {
  ...DEFAULT_SANDBOX_FILES,
}

export function mergeWorkspaceFiles(
  stored?: Record<string, string>,
): Record<string, string> {
  const merged = { ...DEFAULT_WORKSPACE_FILES }
  for (const [path, content] of Object.entries(stored ?? {})) {
    const normalized = normalizeWorkspacePath(path)
    if (normalized) {
      merged[normalized] = sanitizeKnownSandboxFileContent(normalized, content)
    }
  }
  return merged
}

export function workspaceFilesSignature(files: Record<string, string>): string {
  const paths = Object.keys(files).sort((a, b) => a.localeCompare(b))
  let out = ''
  for (const path of paths) {
    out += `${path}:${files[path].length};`
  }
  return out
}
