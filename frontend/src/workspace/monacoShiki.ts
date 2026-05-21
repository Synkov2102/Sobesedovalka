import { shikiToMonaco } from '@shikijs/monaco'
import type { OnMount } from '@monaco-editor/react'
import { createHighlighter, type Highlighter } from 'shiki'

type MonacoMountApi = Parameters<OnMount>[1]

const SHIKI_THEMES = ['dark-plus', 'light-plus'] as const
const SHIKI_LANGS = [
  'typescript',
  'javascript',
  'css',
  'html',
  'json',
] as const

let highlighterPromise: Promise<Highlighter> | null = null
let shikiApplied = false

export function monacoThemeId(mode: 'dark' | 'light'): (typeof SHIKI_THEMES)[number] {
  return mode === 'dark' ? 'dark-plus' : 'light-plus'
}

async function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [...SHIKI_THEMES],
    langs: [...SHIKI_LANGS],
  })
  return highlighterPromise
}

export async function configureMonacoShiki(monaco: MonacoMountApi): Promise<void> {
  if (shikiApplied) {
    return
  }
  const highlighter = await getHighlighter()
  shikiToMonaco(highlighter, monaco)
  shikiApplied = true
}
