import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import type { TaskPresetFile } from '../../types/api.types'
import { PlaygroundFileExplorer } from '../PlaygroundFileExplorer'
import '../Playground.css'
import {
  mergeWorkspaceFiles,
  workspaceFilesSignature,
} from '../../workspace/workspaceDefaults'
import {
  WorkspaceProvider,
  useWorkspace,
} from '../../workspace/WorkspaceContext'
import { WorkspaceCollabFsBridge } from '../../workspace/WorkspaceCollabFsBridge'
import { MonacoCodeEditor } from '../../workspace/MonacoCodeEditor'
import { ClientPreview } from '../../workspace/ClientPreview'
import { ResizableWorkspace } from '../../workspace/ResizableWorkspace'
import { CollabYDocContext } from '../../collab/collabYDocContext'

const SKIP_PRESET_EXPORT_PATHS = new Set([
  '/package-lock.json',
  '/pnpm-lock.yaml',
  '/yarn.lock',
])

export type PresetSandpackWorkspaceHandle = {
  getExport: () => {
    files: TaskPresetFile[]
    solutionFiles: TaskPresetFile[]
  }
}

export type PresetSandpackWorkspaceProps = {
  initialFiles?: Record<string, string>
  initialSolutionFiles?: Record<string, string>
}

const PresetWorkspaceBindings = forwardRef<
  PresetSandpackWorkspaceHandle,
  { initialSolutionPaths: string[] }
>(function PresetWorkspaceBindings({ initialSolutionPaths }, ref) {
  const workspace = useWorkspace()
  const [solutionPaths, setSolutionPaths] = useState(
    () => new Set(initialSolutionPaths),
  )

  const handleToggleSolution = useCallback((path: string) => {
    setSolutionPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      getExport: () => {
        const files: TaskPresetFile[] = []
        const solutionFiles: TaskPresetFile[] = []
        for (const [path, content] of Object.entries(workspace.files)
          .filter(([p]) => !SKIP_PRESET_EXPORT_PATHS.has(p))
          .sort(([a], [b]) => a.localeCompare(b))) {
          const entry = { path, content }
          if (solutionPaths.has(path)) {
            solutionFiles.push(entry)
          } else {
            files.push(entry)
          }
        }
        return { files, solutionFiles }
      },
    }),
    [solutionPaths, workspace.files],
  )

  return (
    <CollabYDocContext.Provider value={{ doc: null, synced: false }}>
      <WorkspaceCollabFsBridge>
        <div className="playground__providerInner">
          <ResizableWorkspace>
            <PlaygroundFileExplorer
              solutionPaths={solutionPaths}
              onToggleSolution={handleToggleSolution}
            />
            <MonacoCodeEditor />
            <ClientPreview />
          </ResizableWorkspace>
        </div>
      </WorkspaceCollabFsBridge>
    </CollabYDocContext.Provider>
  )
})

export const PresetSandpackWorkspace = forwardRef<
  PresetSandpackWorkspaceHandle,
  PresetSandpackWorkspaceProps
>(function PresetSandpackWorkspace(
  { initialFiles, initialSolutionFiles },
  ref,
) {
  const mergedStored = useMemo(() => {
    return {
      ...(initialFiles ?? {}),
      ...(initialSolutionFiles ?? {}),
    }
  }, [initialFiles, initialSolutionFiles])

  const files = useMemo(() => mergeWorkspaceFiles(mergedStored), [mergedStored])
  const key = useMemo(() => workspaceFilesSignature(files), [files])
  const initialSolutionPaths = useMemo(
    () =>
      Object.keys(initialSolutionFiles ?? {}).sort((a, b) =>
        a.localeCompare(b),
      ),
    [initialSolutionFiles],
  )

  return (
    <div className="playground playground--fill">
      <WorkspaceProvider key={key} initialFiles={files}>
        <PresetWorkspaceBindings
          ref={ref}
          initialSolutionPaths={initialSolutionPaths}
        />
      </WorkspaceProvider>
    </div>
  )
})
