export function sortPaths(paths: string[]): string[] {
  return Array.from(new Set(paths)).sort((a, b) => a.localeCompare(b))
}

export function sortUniqueFolderPaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter((p) => p.length > 0 && p !== '/'))).sort(
    (a, b) => a.localeCompare(b),
  )
}

