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
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { normalizeSandpackFilePath } from '../../collab/sandpackPaths'
import { sandpackFilesSignature } from '../../sandbox/sandpackCode'
import {
  SANDPACK_RUNTIME_OPTIONS,
  SANDPACK_TEMPLATE,
} from '../../sandbox/sandpackConfig'
import {
  filesForPresetPersist,
  getSandpackProviderFilesFromStored,
} from '../../sandbox/sandpackResolve'
import type { TaskPresetFile } from '../../types/api.types'
import { LocalSandpackFsProvider } from '../LocalSandpackFsProvider'
import { PlaygroundFileExplorer } from '../PlaygroundFileExplorer'
import { typescriptCodeEditorExtensions } from '../codeEditorExtensions'
import '../Playground.css'

const SKIP_PRESET_EXPORT_PATHS = new Set([
  '/package-lock.json',
  '/pnpm-lock.yaml',
  '/yarn.lock',
])

function collectVisibleSandpackFiles(
  files: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {}
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
    out[normalized] = code
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

const PresetSandpackBindings = forwardRef<PresetSandpackWorkspaceHandle>(
  function PresetSandpackBindings(_, ref) {
    const { sandpack } = useSandpack()
    const sandpackFilesRef = useRef(sandpack.files)
    useLayoutEffect(() => {
      sandpackFilesRef.current = sandpack.files
    }, [sandpack.files])

    useImperativeHandle(
      ref,
      () => ({
        getPresetFiles: () =>
          Object.entries(
            filesForPresetPersist(
              collectVisibleSandpackFiles(
                sandpackFilesRef.current as Record<string, unknown>,
              ),
            ),
          ).map(([path, content]) => ({ path, content })),
      }),
      [],
    )

    return (
      <LocalSandpackFsProvider>
        <div className="playground__providerInner">
          <SandpackLayout className="playground__sandpack">
            <PlaygroundFileExplorer />
            <SandpackCodeEditor
              showTabs
              showLineNumbers
              closableTabs
              extensions={typescriptCodeEditorExtensions}
            />
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
    (): ReturnType<typeof getSandpackProviderFilesFromStored> =>
      getSandpackProviderFilesFromStored(initialFiles),
    [initialFiles],
  )

  const providerKey = useMemo(
    (): string => sandpackFilesSignature(sandpackFiles),
    [sandpackFiles],
  )

  return (
    <div className="playground playground--fill">
      <div className="playground__spWrap">
        <SandpackProvider
          key={providerKey}
          template={SANDPACK_TEMPLATE}
          theme={sandpackTheme}
          files={sandpackFiles}
          options={SANDPACK_RUNTIME_OPTIONS}
        >
          <PresetSandpackBindings ref={ref} />
        </SandpackProvider>
      </div>
    </div>
  )
})
