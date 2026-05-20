/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COLLAB_WS_URL?: string
  /** `true` — логи синхронизации редактора в production-сборке. */
  readonly VITE_COLLAB_SYNC_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
