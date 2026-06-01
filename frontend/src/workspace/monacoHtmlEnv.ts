import type { OnMount } from '@monaco-editor/react'

type MonacoMountApi = Parameters<OnMount>[1]

let configured = false

export function configureMonacoHtml(monaco: MonacoMountApi): void {
  if (configured) {
    return
  }
  configured = true

  monaco.languages.html.htmlDefaults.setOptions({
    suggest: { html5: true, angular1: false, ionic: false },
    format: {
      wrapAttributes: 'auto',
    },
  })
}
