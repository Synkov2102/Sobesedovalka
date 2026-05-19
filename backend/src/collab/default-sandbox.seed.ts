/** Совпадает с frontend/src/sandbox/defaultFiles.ts — стартовые файлы пустой комнаты. */
export const DEFAULT_SANDBOX_FILES: Record<string, string> = {
  '/App.tsx': `import "./styles.css";
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
`,
  '/index.html': `<!DOCTYPE html>
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
`,
  '/index.tsx': `import { StrictMode } from "react";
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
`,
  '/package.json': `{
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
`,
  '/styles.css': `.sandbox-main {
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
`,
  '/tsconfig.json': `{
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
`,
  '/tsconfig.node.json': `{
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
`,
  '/vite-env.d.ts': `/// <reference types="vite/client" />
`,
  '/vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
`,
};

export const DEFAULT_SANDBOX_FOLDERS: string[] = [];
