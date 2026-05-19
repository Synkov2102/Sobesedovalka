import { DEFAULT_SANDBOX_FILES } from './default-sandbox.seed';
import { normalizeSandpackFilePath } from './sandpack-paths';

/** Починка старых комнат: в шаблоне было `\${n}` → в Mongo попало `${n}`. */
export function sanitizeKnownSandboxFileContent(
  path: string,
  content: string,
): string {
  if (path !== '/App.tsx') {
    return content;
  }
  return content.replace(/(Клики|Clicks):\s*\$\{n\}/g, '$1: {n}');
}

/** Старые комнаты хранили только App/styles — дополняем полным Vite-шаблоном. */
export function mergeWithDefaultSandboxFiles(
  stored: Record<string, string>,
): Record<string, string> {
  const merged: Record<string, string> = { ...DEFAULT_SANDBOX_FILES };
  for (const [path, content] of Object.entries(stored)) {
    const normalized = normalizeSandpackFilePath(path);
    if (!normalized) {
      continue;
    }
    merged[normalized] = sanitizeKnownSandboxFileContent(normalized, content);
  }
  return merged;
}

export function sandboxFilesNeedPersist(
  stored: Record<string, string>,
  merged: Record<string, string>,
): boolean {
  const keys = new Set([...Object.keys(stored), ...Object.keys(merged)]);
  for (const path of keys) {
    if (stored[path] !== merged[path]) {
      return true;
    }
  }
  return false;
}
