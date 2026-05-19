export const DEFAULT_SANDBOX_APP = `import "./styles.css";
import { useState } from "react";

export default function App() {
  const [n, setN] = useState(0);
  return (
    <main className="sandbox-main">
      <h1>React + Vite (TypeScript)</h1>
      <p>
        Создавайте папки и файлы <code>.tsx</code> в проводнике, затем добавьте
        импорт в начало этого файла и отрисуйте компонент ниже.
      </p>
      <button type="button" onClick={() => setN((c) => c + 1)}>
        Клики: {n}
      </button>
    </main>
  );
}
`

export const DEFAULT_SANDBOX_STYLES = `.sandbox-main {
  font-family: system-ui, sans-serif;
  max-width: 36rem;
  padding: 1rem;
  line-height: 1.5;
}

.sandbox-main h1 {
  font-size: 1.35rem;
  margin: 0 0 0.5rem;
}

.sandbox-main p {
  margin: 0 0 1rem;
  opacity: 0.9;
}

.sandbox-main code {
  font-size: 0.9em;
}

.sandbox-main button {
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #64748b;
  background: #0f172a;
  color: #f8fafc;
  cursor: pointer;
}

.sandbox-main button:hover {
  opacity: 0.92;
}
`

export const DEFAULT_SANDBOX_INDEX = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import App from "./App";
import React from "react";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
`

export const DEFAULT_SANDBOX_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
`

export const DEFAULT_SANDBOX_PACKAGE_JSON = `{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^4.9.5",
    "vite": "4.2.0",
    "esbuild-wasm": "^0.17.12"
  }
}
`

export const DEFAULT_SANDBOX_TSCONFIG = `{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": [
      "DOM",
      "DOM.Iterable",
      "ESNext"
    ],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": [
    "**/*.ts",
    "**/*.tsx"
  ],
  "references": [
    {
      "path": "./tsconfig.node.json"
    }
  ]
}
`

export const DEFAULT_SANDBOX_TSCONFIG_NODE = `{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": [
    "vite.config.ts"
  ]
}
`

export const DEFAULT_SANDBOX_VITE_ENV = `/// <reference types="vite/client" />
`

export const DEFAULT_SANDBOX_VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
`

/** Починка старых комнат: в шаблоне ошибочно экранировали `\${n}` → в файле оказалось `${n}`. */
export function sanitizeKnownSandboxFileContent(
  path: string,
  content: string,
): string {
  if (path !== '/App.tsx') {
    return content
  }
  return content.replace(/(Клики|Clicks):\s*\$\{n\}/g, '$1: {n}')
}

export const DEFAULT_SANDBOX_FILES: Record<string, string> = {
  '/App.tsx': DEFAULT_SANDBOX_APP,
  '/index.html': DEFAULT_SANDBOX_INDEX_HTML,
  '/index.tsx': DEFAULT_SANDBOX_INDEX,
  '/package.json': DEFAULT_SANDBOX_PACKAGE_JSON,
  '/styles.css': DEFAULT_SANDBOX_STYLES,
  '/tsconfig.json': DEFAULT_SANDBOX_TSCONFIG,
  '/tsconfig.node.json': DEFAULT_SANDBOX_TSCONFIG_NODE,
  '/vite-env.d.ts': DEFAULT_SANDBOX_VITE_ENV,
  '/vite.config.ts': DEFAULT_SANDBOX_VITE_CONFIG,
}

/** Только переопределения для Sandpack — остальное даёт template `vite-react-ts`. */
export const SANDPACK_BOOTSTRAP_FILES: Record<string, string> = {
  '/App.tsx': DEFAULT_SANDBOX_APP,
  '/styles.css': DEFAULT_SANDBOX_STYLES,
}

/** Vite-инфраструктуру даёт template `vite-react-ts`; в Sandpack не перезаписываем из Mongo. */
export const SANDPACK_INFRA_PATHS = new Set(
  Object.keys(DEFAULT_SANDBOX_FILES).filter(
    (path) => path !== '/App.tsx' && path !== '/styles.css',
  ),
)

export function filesForSandpackSync(
  merged: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...SANDPACK_BOOTSTRAP_FILES }
  for (const [path, content] of Object.entries(merged)) {
    if (SANDPACK_INFRA_PATHS.has(path)) {
      continue
    }
    out[path] = sanitizeKnownSandboxFileContent(path, content)
  }
  return out
}
