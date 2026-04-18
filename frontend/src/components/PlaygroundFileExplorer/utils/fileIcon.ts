import type { FileIconSpec } from '../types/playgroundFileExplorer.types'
import { getEntryName } from './paths'

export function getFallbackFileLabel(fileName: string): string {
  const normalized = fileName.replace(/^\.+/, '')
  const parts = normalized.split('.').filter(Boolean)
  const candidate = (parts.at(-1) || normalized || 'file').replace(
    /[^a-z0-9]/gi,
    '',
  )
  return candidate.slice(0, 2).toUpperCase() || 'F'
}

export function getFileIconSpec(filePath: string): FileIconSpec {
  const fileName = getEntryName(filePath).toLowerCase()

  if (fileName === 'package.json' || fileName === 'package-lock.json') {
    return { label: 'N', tone: 'npm', title: 'npm' }
  }

  if (/^vite\.config\./.test(fileName)) {
    return { label: 'V', tone: 'vite', title: 'Vite' }
  }

  if (fileName === 'tsconfig.json' || fileName.startsWith('tsconfig.')) {
    return { label: 'TS', tone: 'ts', title: 'TypeScript config' }
  }

  if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
    return { label: 'R', tone: 'react', title: 'React component' }
  }

  if (fileName.endsWith('.d.ts') || fileName.endsWith('.ts')) {
    return { label: 'TS', tone: 'ts', title: 'TypeScript' }
  }

  if (
    fileName.endsWith('.js') ||
    fileName.endsWith('.mjs') ||
    fileName.endsWith('.cjs')
  ) {
    return { label: 'JS', tone: 'js', title: 'JavaScript' }
  }

  if (
    fileName.endsWith('.css') ||
    fileName.endsWith('.scss') ||
    fileName.endsWith('.sass') ||
    fileName.endsWith('.less')
  ) {
    return { label: 'CSS', tone: 'css', title: 'Stylesheet' }
  }

  if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    return { label: '<>', tone: 'html', title: 'HTML' }
  }

  if (fileName.endsWith('.json')) {
    return { label: '{}', tone: 'json', title: 'JSON' }
  }

  if (fileName.endsWith('.md') || fileName.endsWith('.mdx')) {
    return { label: 'MD', tone: 'md', title: 'Markdown' }
  }

  return {
    label: getFallbackFileLabel(fileName),
    tone: 'default',
    title: 'File',
  }
}
