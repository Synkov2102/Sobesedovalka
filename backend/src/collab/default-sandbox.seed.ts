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
        Create folders and <code>.tsx</code> files in the file explorer, then add an
        import at the top of this file and render your component below.
      </p>
      <button type="button" onClick={() => setN((c) => c + 1)}>
        Clicks: \${n}
      </button>
    </main>
  );
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
}

export const DEFAULT_SANDBOX_FOLDERS: string[] = []
