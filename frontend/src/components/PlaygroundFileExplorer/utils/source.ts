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

export function defaultComponentSource(filePath: string): string {
  const name = pathToComponentName(filePath)
  const imp = importPathFromApp(filePath)
  return `export function ${name}() {
  return (
    <section
      style={{
        padding: "0.75rem",
        border: "1px dashed #94a3b8",
        borderRadius: 8,
        marginTop: "0.75rem",
      }}
    >
      <strong>${name}</strong>
      <p style={{ margin: "0.35rem 0 0", fontSize: 14 }}>
        Import in App.tsx: <code>import { ${name} } from "${imp}"</code>
      </p>
    </section>
  );
}
`
}
