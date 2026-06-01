import {
  createOAuthState,
  createPkcePair,
  storeOAuthValue,
  takeOAuthValue,
} from './oauthPkce';

const YANDEX_PKCE_KEY = 'sobesedovalka_yandex_pkce';
const YANDEX_STATE_KEY = 'sobesedovalka_yandex_state';
const YANDEX_CALLBACK_FLAG = 'sobesedovalka_yandex_callback';

const YANDEX_AUTHORIZE_URL = 'https://oauth.yandex.com/authorize';

export function yandexClientId(): string | null {
  const id = import.meta.env.VITE_YANDEX_CLIENT_ID?.trim();
  return id || null;
}

export function yandexRedirectUri(): string {
  const fromEnv = import.meta.env.VITE_YANDEX_REDIRECT_URI?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return window.location.origin;
}

export function markYandexOAuthStarted(): void {
  sessionStorage.setItem(YANDEX_CALLBACK_FLAG, '1');
}

export function isYandexOAuthPending(): boolean {
  return sessionStorage.getItem(YANDEX_CALLBACK_FLAG) === '1';
}

export function clearYandexOAuthPending(): void {
  sessionStorage.removeItem(YANDEX_CALLBACK_FLAG);
}

export function takeYandexCodeVerifier(): string | null {
  return takeOAuthValue(YANDEX_PKCE_KEY);
}

export function takeYandexOAuthState(): string | null {
  return takeOAuthValue(YANDEX_STATE_KEY);
}

export async function startYandexLogin(params: {
  clientId: string;
  redirectUri: string;
}): Promise<void> {
  const { codeVerifier, codeChallenge } = await createPkcePair();
  const state = createOAuthState();
  storeOAuthValue(YANDEX_PKCE_KEY, codeVerifier);
  storeOAuthValue(YANDEX_STATE_KEY, state);
  markYandexOAuthStarted();

  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.assign(`${YANDEX_AUTHORIZE_URL}?${authParams}`);
}

export type YandexCallbackParams = {
  code: string;
  state: string;
};

export function readYandexCallbackFromUrl(): YandexCallbackParams | null {
  if (!isYandexOAuthPending()) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    clearYandexOAuthPending();
    throw new Error(error);
  }

  if (!code || !state) {
    return null;
  }

  return { code, state };
}

export function stripOAuthParamsFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}
