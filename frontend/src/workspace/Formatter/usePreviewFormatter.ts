import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { useCollabFileSync } from '../../collab/collabFileSyncContext'
import { useCollabYDoc } from '../../collab/collabYDocContext'
import { getYFileText, replaceYText } from '../../collab/collabYjsModel'
import { useWorkspace } from '../WorkspaceContext'
import { formatWorkspaceCode } from './formatWorkspaceCode'
import { isPreviewFormatterMessage } from './previewFormatterBridge'

export function usePreviewFormatter(
  iframeRef: RefObject<HTMLIFrameElement | null>,
): void {
  const { files, activeFile, updateWorkspaceFile } = useWorkspace()
  const { doc, synced } = useCollabYDoc()
  const fileSync = useCollabFileSync()
  const latestFilesRef = useRef(files)
  const latestActiveFileRef = useRef(activeFile)

  useEffect(() => {
    latestFilesRef.current = files
    latestActiveFileRef.current = activeFile
  }, [activeFile, files])

  const formatActiveWorkspaceFile = useCallback(async () => {
    if (doc && !synced) {
      return
    }
    const path = latestActiveFileRef.current
    const source = latestFilesRef.current[path]
    if (!path || source === undefined) {
      return
    }

    const result = await formatWorkspaceCode(path, source)
    if (!result.ok) {
      console.warn(result.error)
      return
    }
    if (result.code === source || latestFilesRef.current[path] !== source) {
      return
    }

    updateWorkspaceFile(path, result.code)
    if (doc && synced) {
      doc.transact(() => {
        replaceYText(getYFileText(doc, path), result.code)
      }, 'preview-formatter')
      return
    }
    fileSync?.emitFileChange(path, result.code)
  }, [doc, fileSync, synced, updateWorkspaceFile])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data: unknown = event.data
      if (
        event.source !== iframeRef.current?.contentWindow ||
        !isPreviewFormatterMessage(data)
      ) {
        return
      }
      void formatActiveWorkspaceFile()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [formatActiveWorkspaceFile, iframeRef])
}
