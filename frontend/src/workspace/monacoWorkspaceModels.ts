import type { OnMount } from '@monaco-editor/react'
import { normalizeWorkspacePath } from './workspacePaths'

type MonacoMountApi = Parameters<OnMount>[1]

const managedPaths = new Set<string>()

function isTypecheckableWorkspaceFile(path: string): boolean {
  return /\.(tsx?|jsx?)$/i.test(path)
}

/** Stable `file://` URI shared by the editor and the TypeScript language service. */
export function workspaceFileUri(path: string): string {
  const normalized = normalizeWorkspacePath(path)
  return normalized ? `file://${normalized}` : ''
}

export function workspaceModelUri(
  monaco: MonacoMountApi,
  filePath: string,
): ReturnType<MonacoMountApi['Uri']['parse']> {
  return monaco.Uri.parse(workspaceFileUri(filePath))
}

export function syncWorkspaceModels(
  monaco: MonacoMountApi,
  files: Record<string, string>,
  options: {
    activePath: string
    languageForPath: (path: string) => string
  },
): void {
  const activePath = normalizeWorkspacePath(options.activePath)
  const nextPaths = new Set<string>()

  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizeWorkspacePath(rawPath)
    if (!path || !isTypecheckableWorkspaceFile(path)) {
      continue
    }
    nextPaths.add(path)

    const uri = workspaceModelUri(monaco, path)
    const language = options.languageForPath(path)
    let model = monaco.editor.getModel(uri)

    if (!model) {
      monaco.editor.createModel(content, language, uri)
      managedPaths.add(path)
      continue
    }

    if (model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language)
    }

    // Active file content is owned by the editor / Yjs binding.
    if (path === activePath) {
      continue
    }

    if (model.getValue() !== content) {
      model.setValue(content)
    }
  }

  for (const path of managedPaths) {
    if (nextPaths.has(path)) {
      continue
    }
    monaco.editor.getModel(workspaceModelUri(monaco, path))?.dispose()
    managedPaths.delete(path)
  }
}

export function disposeWorkspaceModels(monaco: MonacoMountApi): void {
  for (const path of managedPaths) {
    monaco.editor.getModel(workspaceModelUri(monaco, path))?.dispose()
  }
  managedPaths.clear()
}
