import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react'
import { useTheme } from '@mui/material/styles'
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react'
import { normalizeSandpackFilePath } from '../../collab/sandpackPaths'
import {
  DEFAULT_SANDBOX_APP,
  DEFAULT_SANDBOX_STYLES,
} from '../../sandbox/defaultFiles'
import type { TaskPresetFile } from '../../types/api.types'
import { LocalSandpackFsProvider } from '../LocalSandpackFsProvider'
import { PlaygroundFileExplorer } from '../PlaygroundFileExplorer'
import '../Playground.css'

const SKIP_PRESET_EXPORT_PATHS = new Set([
  '/package-lock.json',
  '/pnpm-lock.yaml',
  '/yarn.lock',
])

function collectPresetFilesFromSandpack(
  files: Record<string, unknown>,
): TaskPresetFile[] {
  const out: TaskPresetFile[] = []
  for (const path of Object.keys(files).sort((a, b) => a.localeCompare(b))) {
    const entry = files[path]
    if (entry == null || typeof entry !== 'object') {
      continue
    }
    const o = entry as { hidden?: boolean; code?: unknown }
    if (o.hidden) {
      continue
    }
    const code = typeof o.code === 'string' ? o.code : undefined
    if (code === undefined) {
      continue
    }
    const normalized = normalizeSandpackFilePath(path)
    if (!normalized || SKIP_PRESET_EXPORT_PATHS.has(normalized)) {
      continue
    }
    out.push({ path: normalized, content: code })
  }
  return out
}

export type PresetSandpackWorkspaceHandle = {
  getPresetFiles: () => TaskPresetFile[]
}

export type PresetSandpackWorkspaceProps = {
  /** Пути и содержимое как в API пресета; без пропа — стартовый шаблон создания. */
  initialFiles?: Record<string, string>
}

function defaultSandpackFiles(): Record<string, { code: string }> {
  return {
    '/App.tsx': { code: DEFAULT_SANDBOX_APP },
    '/styles.css': { code: DEFAULT_SANDBOX_STYLES },
  }
}

function sandpackFilesFromPresetRecord(
  initialFiles: Record<string, string> | undefined,
): Record<string, { code: string }> {
  if (!initialFiles || Object.keys(initialFiles).length === 0) {
    return defaultSandpackFiles()
  }
  const out: Record<string, { code: string }> = {}
  for (const [path, content] of Object.entries(initialFiles)) {
    const normalized = normalizeSandpackFilePath(path)
    if (!normalized || SKIP_PRESET_EXPORT_PATHS.has(normalized)) {
      continue
    }
    out[normalized] = { code: content }
  }
  return Object.keys(out).length > 0 ? out : defaultSandpackFiles()
}

const PresetSandpackBindings = forwardRef<PresetSandpackWorkspaceHandle>(
  function PresetSandpackBindings(_, ref) {
    const { sandpack } = useSandpack()

    useImperativeHandle(
      ref,
      () => ({
        getPresetFiles: () =>
          collectPresetFilesFromSandpack(
            sandpack.files as Record<string, unknown>,
          ),
      }),
      [sandpack.files],
    )

    return (
      <LocalSandpackFsProvider>
        <div className="playground__providerInner">
          <SandpackLayout className="playground__sandpack">
            <PlaygroundFileExplorer />
            <SandpackCodeEditor showTabs showLineNumbers closableTabs />
            <SandpackPreview showNavigator showOpenInCodeSandbox={false} />
          </SandpackLayout>
        </div>
      </LocalSandpackFsProvider>
    )
  },
)

export const PresetSandpackWorkspace = forwardRef<
  PresetSandpackWorkspaceHandle,
  PresetSandpackWorkspaceProps
>(function PresetSandpackWorkspace({ initialFiles }, ref) {
  const muiTheme = useTheme()
  const sandpackTheme = muiTheme.palette.mode

  const sandpackFiles = useMemo(
    () => sandpackFilesFromPresetRecord(initialFiles),
    [initialFiles],
  )

  const sandpackOptions = useMemo(
    () => ({
      autorun: true,
      autoReload: true,
      recompileMode: 'immediate' as const,
    }),
    [],
  )

  const filesKey = useMemo(() => {
    if (!initialFiles || Object.keys(initialFiles).length === 0) {
      return '__default__'
    }
    return JSON.stringify(
      Object.keys(initialFiles)
        .sort()
        .map((k) => [k, initialFiles[k]]),
    )
  }, [initialFiles])

  return (
    <div className="playground playground--fill">
      <div className="playground__spWrap">
        <SandpackProvider
          key={filesKey}
          template="vite-react-ts"
          theme={sandpackTheme}
          files={sandpackFiles}
          options={sandpackOptions}
        >
          <PresetSandpackBindings ref={ref} />
        </SandpackProvider>
      </div>
    </div>
  )
})
