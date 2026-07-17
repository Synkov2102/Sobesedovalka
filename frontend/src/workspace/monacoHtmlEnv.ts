import type { MonacoApi } from './monacoApi'

let configured = false

export function configureMonacoHtml(monaco: MonacoApi): void {
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
