/** Normalize virtual workspace paths to the leading-slash form used by collab storage. */
export function normalizeWorkspacePath(path: string): string {
  const p = path.trim().replace(/\\/g, '/')
  if (!p) {
    return ''
  }
  const withSlash = p.startsWith('/') ? p : `/${p}`
  return withSlash.replace(/\/+/g, '/')
}

