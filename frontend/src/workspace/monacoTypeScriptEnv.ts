import type { OnMount } from '@monaco-editor/react'

type MonacoMountApi = Parameters<OnMount>[1]

import csstypeDts from '../../node_modules/csstype/index.d.ts?raw'
import reactGlobalDts from '../../node_modules/@types/react/global.d.ts?raw'
import reactIndexDts from '../../node_modules/@types/react/index.d.ts?raw'
import reactJsxRuntimeDts from '../../node_modules/@types/react/jsx-runtime.d.ts?raw'
import reactDomIndexDts from '../../node_modules/@types/react-dom/index.d.ts?raw'
import reactDomClientDts from '../../node_modules/@types/react-dom/client.d.ts?raw'

const TYPE_ROOT = 'file:///node_modules'

const SANDBOX_MODULE_STUBS = `
declare module '*.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
declare module '*.scss' {
  const classes: { readonly [key: string]: string }
  export default classes
}
`

const EXTRA_LIBS: ReadonlyArray<{ uri: string; content: string }> = [
  { uri: `${TYPE_ROOT}/csstype/index.d.ts`, content: csstypeDts },
  { uri: `${TYPE_ROOT}/@types/react/global.d.ts`, content: reactGlobalDts },
  { uri: `${TYPE_ROOT}/@types/react/index.d.ts`, content: reactIndexDts },
  { uri: `${TYPE_ROOT}/@types/react/jsx-runtime.d.ts`, content: reactJsxRuntimeDts },
  { uri: `${TYPE_ROOT}/@types/react-dom/index.d.ts`, content: reactDomIndexDts },
  { uri: `${TYPE_ROOT}/@types/react-dom/client.d.ts`, content: reactDomClientDts },
  {
    uri: `${TYPE_ROOT}/@types/sobesedovalka-sandbox/stubs.d.ts`,
    content: SANDBOX_MODULE_STUBS,
  },
]

export function configureMonacoTypeScript(monaco: MonacoMountApi): void {
  const ts = monaco.languages.typescript
  const sharedCompilerOptions = {
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    allowJs: true,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    baseUrl: 'file:///',
    paths: {
      react: ['node_modules/@types/react/index.d.ts'],
      'react/jsx-runtime': ['node_modules/@types/react/jsx-runtime.d.ts'],
      'react-dom': ['node_modules/@types/react-dom/index.d.ts'],
      'react-dom/client': ['node_modules/@types/react-dom/client.d.ts'],
      csstype: ['node_modules/csstype/index.d.ts'],
    },
  }

  for (const { uri, content } of EXTRA_LIBS) {
    ts.typescriptDefaults.addExtraLib(content, uri)
    ts.javascriptDefaults.addExtraLib(content, uri)
  }

  const diagnosticsOptions = {
    noSemanticValidation: false,
    noSyntaxValidation: false,
  }

  ts.typescriptDefaults.setCompilerOptions(sharedCompilerOptions)
  ts.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions)
  ts.javascriptDefaults.setCompilerOptions({
    ...sharedCompilerOptions,
    checkJs: false,
  })
  ts.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions)

  ts.typescriptDefaults.setEagerModelSync(true)
  ts.javascriptDefaults.setEagerModelSync(true)
}
