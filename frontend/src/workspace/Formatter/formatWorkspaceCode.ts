import { format } from 'prettier/standalone'
import * as babelPlugin from 'prettier/plugins/babel'
import * as estreePlugin from 'prettier/plugins/estree'
import * as htmlPlugin from 'prettier/plugins/html'
import * as postcssPlugin from 'prettier/plugins/postcss'
import * as typescriptPlugin from 'prettier/plugins/typescript'

type FormatWorkspaceCodeResult =
  | { ok: true; code: string }
  | { ok: false; error: string }

function parserForPath(path: string): string | null {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) {
    return 'typescript'
  }
  if (path.endsWith('.js') || path.endsWith('.jsx')) {
    return 'babel'
  }
  if (path.endsWith('.css')) {
    return 'css'
  }
  if (path.endsWith('.html')) {
    return 'html'
  }
  if (path.endsWith('.json')) {
    return 'json'
  }
  return null
}

export async function formatWorkspaceCode(
  path: string,
  code: string,
): Promise<FormatWorkspaceCodeResult> {
  const parser = parserForPath(path)
  if (!parser) {
    return { ok: false, error: `Форматирование для ${path} не поддерживается.` }
  }

  try {
    const formatted = await format(code, {
      parser,
      filepath: path,
      plugins: [
        babelPlugin,
        estreePlugin,
        htmlPlugin,
        postcssPlugin,
        typescriptPlugin,
      ],
      semi: false,
      singleQuote: true,
      trailingComma: 'all',
    })
    return { ok: true, code: formatted }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
