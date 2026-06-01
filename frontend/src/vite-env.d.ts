/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COLLAB_WS_URL?: string
  /** `true` — логи синхронизации редактора в production-сборке. */
  readonly VITE_COLLAB_SYNC_DEBUG?: string
  /** ID приложения VK ID (число из кабинета). */
  readonly VITE_VK_APP_ID?: string
  /**
   * Redirect URI, зарегистрированный в VK ID.
   * По умолчанию — `window.location.origin` (например http://localhost:5173).
   */
  readonly VITE_VK_REDIRECT_URI?: string
  readonly VITE_YANDEX_CLIENT_ID?: string
  readonly VITE_YANDEX_REDIRECT_URI?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
