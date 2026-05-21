import * as esbuild from 'esbuild-wasm'
import wasmUrl from 'esbuild-wasm/esbuild.wasm?url'
import { normalizeWorkspacePath } from './workspacePaths'

let initPromise: Promise<void> | null = null

export type PreviewBuildResult =
  | { ok: true; html: string }
  | { ok: false; error: string }

function ensureEsbuild(): Promise<void> {
  initPromise ??= esbuild.initialize({
    wasmURL: wasmUrl,
    worker: true,
  })
  return initPromise
}

function loaderForPath(path: string): esbuild.Loader {
  if (path.endsWith('.tsx')) return 'tsx'
  if (path.endsWith('.ts')) return 'ts'
  if (path.endsWith('.jsx')) return 'jsx'
  if (path.endsWith('.js')) return 'js'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  return 'text'
}

function dirname(path: string): string {
  const i = path.lastIndexOf('/')
  return i <= 0 ? '/' : path.slice(0, i)
}

function resolveLocalPath(importer: string, specifier: string): string {
  if (specifier.startsWith('/')) {
    return normalizeWorkspacePath(specifier)
  }
  const parts = `${dirname(importer)}/${specifier}`.split('/')
  const out: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return `/${out.join('/')}`
}

function resolveWithExtensions(files: Record<string, string>, path: string): string {
  const candidates = [
    path,
    `${path}.tsx`,
    `${path}.ts`,
    `${path}.jsx`,
    `${path}.js`,
    `${path}.css`,
    `${path}.json`,
    `${path}/index.tsx`,
    `${path}/index.ts`,
    `${path}/index.jsx`,
    `${path}/index.js`,
  ]
  return candidates.find((candidate) => files[candidate] !== undefined) ?? path
}

function packageDeps(files: Record<string, string>): Record<string, string> {
  const raw = files['/package.json']
  if (!raw?.trim()) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return {
      ...(parsed.dependencies ?? {}),
      ...(parsed.devDependencies ?? {}),
    }
  } catch {
    return {}
  }
}

function importMapFor(files: Record<string, string>): string {
  const deps = packageDeps(files)
  const imports: Record<string, string> = {
    react: 'https://esm.sh/react',
    'react-dom/client': 'https://esm.sh/react-dom/client',
    'react/jsx-runtime': 'https://esm.sh/react/jsx-runtime',
  }
  for (const name of Object.keys(deps)) {
    if (!imports[name]) {
      imports[name] = `https://esm.sh/${encodeURIComponent(name)}`
    }
  }
  return JSON.stringify({ imports }, null, 2)
}

function htmlFor(js: string, css: string, files: Record<string, string>): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="importmap">${importMapFor(files)}</script>
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">${js}</script>
  </body>
</html>`
}

export async function buildClientPreview(
  files: Record<string, string>,
): Promise<PreviewBuildResult> {
  try {
    await ensureEsbuild()
    const entry = files['/index.tsx']
      ? '/index.tsx'
      : files['/src/main.tsx']
        ? '/src/main.tsx'
        : '/App.tsx'
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      outdir: '/preview',
      format: 'esm',
      jsx: 'automatic',
      target: 'es2020',
      logLevel: 'silent',
      plugins: [
        {
          name: 'workspace-files',
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
              if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
                return { path: args.path, external: true }
              }
              const resolved = resolveWithExtensions(
                files,
                resolveLocalPath(args.importer || entry, args.path),
              )
              return { path: resolved, namespace: 'workspace' }
            })
            build.onLoad({ filter: /.*/, namespace: 'workspace' }, (args) => {
              const contents = files[args.path]
              if (contents === undefined) {
                return {
                  errors: [{ text: `File not found: ${args.path}` }],
                }
              }
              return {
                contents,
                loader: loaderForPath(args.path),
              }
            })
          },
        },
      ],
    })
    const js =
      result.outputFiles.find((file) => file.path.endsWith('.js'))?.text ?? ''
    const css =
      result.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? ''
    return { ok: true, html: htmlFor(js, css, files) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
}

