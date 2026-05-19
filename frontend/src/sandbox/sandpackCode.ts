export type SandpackProviderFiles = Record<string, { code: string }>

/** Быстрый хеш строки (FNV-1a 32-bit) для ключей remount. */
function fnv1aHash(h: number, text: string): number {
  let hash = h
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Стабильный ключ remount `SandpackProvider` при смене набора файлов. */
export function sandpackFilesSignature(files: SandpackProviderFiles): string {
  const paths = Object.keys(files).sort((a, b) => a.localeCompare(b))
  let hash = 2166136261
  for (const path of paths) {
    hash = fnv1aHash(hash, path)
    hash = fnv1aHash(hash, files[path].code)
  }
  return `sp:${hash.toString(36)}:${paths.length}`
}

/** Читает `code` из записи Sandpack (`{ code }` или строка). */
export function readSandpackFileCode(file: unknown): string | undefined {
  if (file == null) {
    return undefined
  }
  if (typeof file === 'string') {
    return file
  }
  if (typeof file === 'object' && file !== null && 'code' in file) {
    const code = (file as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}
