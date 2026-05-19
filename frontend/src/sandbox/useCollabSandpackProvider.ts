import { useCallback, useMemo, useReducer, useState } from 'react'
import { DEFAULT_SANDBOX_FILES } from './defaultFiles'
import {
  sandpackFilesSignature,
  type SandpackProviderFiles,
} from './sandpackCode'
import { SANDPACK_RUNTIME_OPTIONS } from './sandpackConfig'
import {
  resolveSandpackLayout,
  sandpackProviderFilesFromMerged,
  toSandpackProviderFiles,
} from './sandpackResolve'

const DEFAULT_PROVIDER_FILES = sandpackProviderFilesFromMerged(
  DEFAULT_SANDBOX_FILES,
)

type ProviderState = {
  roomId: string
  generation: number
  files: SandpackProviderFiles
  bootCompleted: boolean
}

type ProviderAction =
  | { type: 'reset'; roomId: string }
  | {
      type: 'remount'
      roomId: string
      files: SandpackProviderFiles
    }
  | { type: 'mark-boot-done'; roomId: string }

function createInitialState(roomId: string): ProviderState {
  return {
    roomId,
    generation: 0,
    files: DEFAULT_PROVIDER_FILES,
    bootCompleted: false,
  }
}

function providerReducer(
  state: ProviderState,
  action: ProviderAction,
): ProviderState {
  switch (action.type) {
    case 'reset':
      return createInitialState(action.roomId)
    case 'remount':
      return {
        roomId: action.roomId,
        generation: state.generation + 1,
        files: action.files,
        bootCompleted: true,
      }
    case 'mark-boot-done':
      return { ...state, roomId: action.roomId, bootCompleted: true }
    default:
      return state
  }
}

/**
 * Состояние `SandpackProvider` для collab-комнаты: старт с дефолтного шаблона,
 * remount при первом snapshot с кастомной структурой файлов (пресет).
 */
export function useCollabSandpackProvider(roomId: string) {
  const defaultSignature = useMemo(
    () => sandpackFilesSignature(DEFAULT_PROVIDER_FILES),
    [],
  )
  const [state, dispatch] = useReducer(
    providerReducer,
    roomId,
    createInitialState,
  )
  const [trackedRoomId, setTrackedRoomId] = useState(roomId)

  if (roomId !== trackedRoomId) {
    setTrackedRoomId(roomId)
    dispatch({ type: 'reset', roomId })
  }

  const requestProviderBoot = useCallback(
    (merged: Record<string, string>): boolean => {
      if (!roomId || state.bootCompleted) {
        return false
      }

      const layout = resolveSandpackLayout(merged)
      if (!layout.custom) {
        dispatch({ type: 'mark-boot-done', roomId })
        return false
      }

      const nextFiles = toSandpackProviderFiles(layout.syncFiles)
      if (sandpackFilesSignature(nextFiles) === defaultSignature) {
        dispatch({ type: 'mark-boot-done', roomId })
        return false
      }

      dispatch({ type: 'remount', roomId, files: nextFiles })
      return true
    },
    [roomId, defaultSignature, state.bootCompleted],
  )

  return {
    providerKey: `${roomId}:${state.generation}`,
    providerFiles: state.files,
    requestProviderBoot,
    sandpackOptions: SANDPACK_RUNTIME_OPTIONS,
  }
}
