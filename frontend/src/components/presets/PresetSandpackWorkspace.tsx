import { forwardRef, useImperativeHandle, useMemo } from 'react'
import type { TaskPresetFile } from '../../types/api.types'
import { PlaygroundFileExplorer } from '../PlaygroundFileExplorer'
import '../Playground.css'
import {
  mergeWorkspaceFiles,
  workspaceFilesSignature,
} from '../../workspace/workspaceDefaults'
import { WorkspaceProvider, useWorkspace } from '../../workspace/WorkspaceContext'
import { WorkspaceCollabFsBridge } from '../../workspace/WorkspaceCollabFsBridge'
import { MonacoCodeEditor } from '../../workspace/MonacoCodeEditor'
import { ClientPreview } from '../../workspace/ClientPreview'
import { CollabYDocContext } from '../../collab/collabYDocContext'

const SKIP_PRESET_EXPORT_PATHS = new Set([
  '/package-lock.json',
  '/pnpm-lock.yaml',
  '/yarn.lock',
])

export type PresetSandpackWorkspaceHandle = {
  getPresetFiles: () => TaskPresetFile[]
}

export type PresetSandpackWorkspaceProps = {
  initialFiles?: Record<string, string>
}

const PresetWorkspaceBindings = forwardRef<PresetSandpackWorkspaceHandle>(
  function PresetWorkspaceBindings(_, ref) {
    const workspace = useWorkspace()
    useImperativeHandle(
      ref,
      () => ({
        getPresetFiles: () =>
          Object.entries(workspace.files)
            .filter(([path]) => !SKIP_PRESET_EXPORT_PATHS.has(path))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([path, content]) => ({ path, content })),
      }),
      [workspace.files],
    )

    return (
      <CollabYDocContext.Provider value={{ doc: null, synced: false }}>
        <WorkspaceCollabFsBridge>
          <div className="playground__providerInner">
            <div className="playground__workspace">
              <PlaygroundFileExplorer />
              <MonacoCodeEditor />
              <ClientPreview />
            </div>
          </div>
        </WorkspaceCollabFsBridge>
      </CollabYDocContext.Provider>
    )
  },
)

export const PresetSandpackWorkspace = forwardRef<
  PresetSandpackWorkspaceHandle,
  PresetSandpackWorkspaceProps
>(function PresetSandpackWorkspace({ initialFiles }, ref) {
  const files = useMemo(() => mergeWorkspaceFiles(initialFiles), [initialFiles])
  const key = useMemo(() => workspaceFilesSignature(files), [files])

  return (
    <div className="playground playground--fill">
      <WorkspaceProvider key={key} initialFiles={files}>
        <PresetWorkspaceBindings ref={ref} />
      </WorkspaceProvider>
    </div>
  )
})

