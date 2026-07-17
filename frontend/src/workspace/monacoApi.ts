import type * as MonacoNS from 'monaco-editor'

/** Monaco namespace API from `onMount` / `beforeMount` (avoids broken OnMount inference in ESLint). */
export type MonacoApi = typeof MonacoNS
