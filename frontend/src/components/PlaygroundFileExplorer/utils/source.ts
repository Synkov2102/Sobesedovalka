export function pathToComponentName(relativePath: string): string {
  const base =
    relativePath
      .replace(/^\/+/, '')
      .replace(/\.tsx?$/i, '')
      .split('/')
      .pop() || 'Item'
  const pascal = base
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
  const ident = /^[A-Za-z_$]/.test(pascal) ? pascal : `C${pascal}`
  return ident || 'Item'
}

export function importPathFromApp(filePath: string): string {
  const normalized = filePath.replace(/^\/+/, '').replace(/\.tsx$/i, '')
  return normalized.startsWith('./') ? normalized : `./${normalized}`
}
