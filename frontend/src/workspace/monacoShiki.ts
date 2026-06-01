import { shikiToMonaco } from '@shikijs/monaco'
import type { OnMount } from '@monaco-editor/react'
import { createHighlighter, type Highlighter } from 'shiki'
import { EDITOR_SHIKI_THEMES } from './editorPreferences'

type MonacoMountApi = Parameters<OnMount>[1]
const SHIKI_LANGS = [
  'typescript',
  'javascript',
  'css',
  'html',
  'json',
] as const

let highlighterPromise: Promise<Highlighter> | null = null
let shikiApplied = false

async function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [...EDITOR_SHIKI_THEMES],
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
