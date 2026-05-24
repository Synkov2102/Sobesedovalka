import {
  esmPathToProxyUrl,
  rewriteEsmShUrls,
  shouldRewriteBody,
} from './preview-proxy.rewrite';

describe('esmPathToProxyUrl', () => {
  it('appends dev query flag', () => {
    expect(esmPathToProxyUrl('react', '/api/preview-proxy')).toBe(
      '/api/preview-proxy/react?dev=',
    );
    expect(esmPathToProxyUrl('react?target=es2020', '/api/preview-proxy')).toBe(
      '/api/preview-proxy/react?target=es2020&dev=',
    );
  });
});

describe('rewriteEsmShUrls', () => {
  it('rewrites https and protocol-relative esm.sh URLs', () => {
    const input =
      'import x from "https://esm.sh/react"; import y from "//esm.sh/react-dom";';
    expect(rewriteEsmShUrls(input, '/api/preview-proxy')).toBe(
      'import x from "/api/preview-proxy/react?dev="; import y from "/api/preview-proxy/react-dom?dev=";',
    );
  });

  it('rewrites root-relative esm.sh module paths', () => {
    const input =
      'import r from "/react@19.2.6/es2022/react.development.mjs";';
    expect(rewriteEsmShUrls(input, '/api/preview-proxy')).toBe(
      'import r from "/api/preview-proxy/react@19.2.6/es2022/react.development.mjs?dev=";',
    );
  });
});

describe('shouldRewriteBody', () => {
  it('matches javascript and json content types', () => {
    expect(shouldRewriteBody('application/javascript; charset=utf-8')).toBe(
      true,
    );
    expect(shouldRewriteBody('text/plain')).toBe(false);
  });
});
