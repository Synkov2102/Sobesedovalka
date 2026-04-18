/** Match Sandpack file keys (leading `/`). */
export function normalizeSandpackFilePath(path: string): string {
  const p = path.trim().replace(/\\/g, '/');
  if (!p) {
    return '';
  }
  return p.startsWith('/') ? p : `/${p}`;
}
