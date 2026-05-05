import { javascript } from '@codemirror/lang-javascript'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { CustomLanguage } from '@codesandbox/sandpack-react'

const typescriptTypeHighlight = HighlightStyle.define([
  { tag: [tags.typeName, tags.definition(tags.typeName)], color: '#f59e0b' },
])

/** Явно включаем подсветку TypeScript/TSX в лайв-редакторе. */
export const typescriptCodeEditorExtensions = [
  javascript({
    typescript: true,
    jsx: true,
  }),
  syntaxHighlighting(typescriptTypeHighlight),
]

/** Явно сопоставляем расширения файлов с TS/TSX-языком для Sandpack. */
export const typescriptAdditionalLanguages: CustomLanguage[] = [
  {
    name: 'typescript',
    extensions: ['ts'],
    language: javascript({ typescript: true, jsx: false }),
  },
  {
    name: 'typescriptreact',
    extensions: ['tsx'],
    language: javascript({ typescript: true, jsx: true }),
  },
]
