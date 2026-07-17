import { shikiToMonaco } from '@shikijs/monaco'
import { createHighlighter, type Highlighter } from 'shiki'
import { EDITOR_SHIKI_THEMES } from './editorPreferences'
import type { MonacoApi } from './monacoApi'

const SHIKI_LANGS = ['typescript', 'javascript', 'css', 'html', 'json'] as const

let highlighterPromise: Promise<Highlighter> | null = null
let shikiApplied = false

async function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [...EDITOR_SHIKI_THEMES],
    langs: [...SHIKI_LANGS],
  })
  return highlighterPromise
}

export async function configureMonacoShiki(monaco: MonacoApi): Promise<void> {
  if (shikiApplied) {
    return
  }
  const highlighter = await getHighlighter()
  shikiToMonaco(highlighter, monaco)
  shikiApplied = true
}
