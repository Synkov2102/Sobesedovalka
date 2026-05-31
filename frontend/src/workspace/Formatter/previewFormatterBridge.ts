export const PREVIEW_FORMATTER_MESSAGE = 'client-preview-format'

const PREVIEW_FORMATTER_BRIDGE_SCRIPT = `
(() => {
  const messageType = '${PREVIEW_FORMATTER_MESSAGE}';
  const isFormatHotkey = (event) => {
    if (event.code !== 'KeyF') return false;
    const vscodeFormat = event.shiftKey && event.altKey && !event.ctrlKey && !event.metaKey;
    const searchLikeFormat = event.shiftKey && !event.altKey && (event.ctrlKey || event.metaKey);
    return vscodeFormat || searchLikeFormat;
  };
  window.addEventListener('keydown', (event) => {
    if (!isFormatHotkey(event)) return;
    event.preventDefault();
    event.stopPropagation();
    window.parent.postMessage({ type: messageType }, '*');
  }, true);
})();
`

export function instrumentPreviewFormatterHtml(html: string): string {
  const script = `<script>${PREVIEW_FORMATTER_BRIDGE_SCRIPT}</script>`
  return html.includes('<body>')
    ? html.replace('<body>', `<body>${script}`)
    : `${script}${html}`
}

export function isPreviewFormatterMessage(data: unknown): boolean {
  if (typeof data !== 'object' || data === null || !('type' in data)) {
    return false
  }
  return (data as { type?: unknown }).type === PREVIEW_FORMATTER_MESSAGE
}
