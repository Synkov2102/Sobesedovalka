/** Relative to dev server; Vite proxies `/api` to Nest. */
export const API_PREFIX = '/api'

/** Same-origin proxy for esm.sh (Nest `preview-proxy`). */
export const PREVIEW_CDN_PROXY_PREFIX = `${API_PREFIX}/preview-proxy`
