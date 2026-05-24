/** esm.sh `?dev` — readable modules and source maps instead of minified bundles. */
export function ensureEsmDevQuery(url: URL): void {
  if (!url.searchParams.has('dev')) {
    url.searchParams.set('dev', '');
  }
}

/** Paths served from the esm.sh CDN root (not app routes like /src). */
export function isEsmShRootPath(path: string): boolean {
  if (!path || path.includes('..')) {
    return false;
  }
  if (path.startsWith('node/')) {
    return true;
  }
  if (
    path.startsWith('api/') ||
    path.startsWith('src/') ||
    path.startsWith('assets/')
  ) {
    return false;
  }
  if (/^@[^/]+\/[^/]+@[^/]+/.test(path)) {
    return true;
  }
  return /^[^/@]+@[^/]+/.test(path);
}

/** Maps an esm.sh path (optional query) to a same-origin proxy URL with `?dev`. */
export function esmPathToProxyUrl(
  esmPath: string,
  proxyPrefix: string,
): string {
  const base = proxyPrefix.endsWith('/') ? proxyPrefix.slice(0, -1) : proxyPrefix;
  const trimmed = esmPath.replace(/^\//, '');
  const qIndex = trimmed.indexOf('?');
  const path = qIndex >= 0 ? trimmed.slice(0, qIndex) : trimmed;
  const params = new URLSearchParams(
    qIndex >= 0 ? trimmed.slice(qIndex + 1) : '',
  );
  params.set('dev', '');
  return `${base}/${path}?${params.toString()}`;
}

/** Root-relative imports from esm.sh, e.g. `/react@19.2.6/...`. */
export function rewriteEsmRootRelativePaths(
  content: string,
  proxyPrefix: string,
): string {
  return content.replace(
    /(["'`])\/([^"'`]+)\1/g,
    (match, quote: string, path: string) => {
      if (!isEsmShRootPath(path)) {
        return match;
      }
      return `${quote}${esmPathToProxyUrl(path, proxyPrefix)}${quote}`;
    },
  );
}

/** Rewrites esm.sh URLs in proxied module bodies to same-origin proxy paths. */
export function rewriteEsmShUrls(
  content: string,
  proxyPrefix: string,
): string {
  const withoutHosts = content
    .replace(/https?:\/\/esm\.sh\/([^"'`\s)]+)/g, (_, path: string) =>
      esmPathToProxyUrl(path, proxyPrefix),
    )
    .replace(/(?<!=)\/\/esm\.sh\/([^"'`\s)]+)/g, (_, path: string) =>
      esmPathToProxyUrl(path, proxyPrefix),
    );
  return rewriteEsmRootRelativePaths(withoutHosts, proxyPrefix);
}
export function shouldRewriteBody(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  const base = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return (
    base === 'application/javascript' ||
    base === 'text/javascript' ||
    base === 'application/json' ||
    base === 'text/css'
  );
}
