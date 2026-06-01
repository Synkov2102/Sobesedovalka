export const PREVIEW_CONSOLE_MESSAGE = 'client-preview-console'

const PREVIEW_CONSOLE_BRIDGE_SCRIPT = `
(() => {
  const messageType = '${PREVIEW_CONSOLE_MESSAGE}';
  const levels = ['log', 'info', 'warn', 'error', 'debug'];
  const serialize = (value) => {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack || value.message;
    try {
      const seen = new WeakSet();
      return JSON.stringify(value, (_key, item) => {
        if (typeof item === 'function') return '[Function]';
        if (typeof item === 'symbol') return String(item);
        if (typeof item === 'bigint') return String(item) + 'n';
        if (item && typeof item === 'object') {
          if (seen.has(item)) return '[Circular]';
          seen.add(item);
        }
        return item;
      }, 2);
    } catch {
      return String(value);
    }
  };
  const send = (level, args) => {
    window.parent.postMessage({
      type: messageType,
      level,
      args: Array.from(args, serialize),
    }, '*');
  };
  for (const level of levels) {
    const original = console[level]?.bind(console);
    console[level] = (...args) => {
      send(level, args);
      original?.(...args);
    };
  }
  window.addEventListener('error', (event) => {
    send('error', [event.error || event.message]);
  });
  window.addEventListener('unhandledrejection', (event) => {
    send('error', [event.reason]);
  });
})();
`

export function instrumentPreviewHtml(html: string): string {
  const script = `<script>${PREVIEW_CONSOLE_BRIDGE_SCRIPT}</script>`
  return html.includes('<body>')
    ? html.replace('<body>', `<body>${script}`)
    : `${script}${html}`
}
