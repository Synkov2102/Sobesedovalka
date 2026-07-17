import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import { FileTypeIcon } from '../components/PlaygroundFileExplorer/ui/FileTypeIcon'

function parseFilePath(filePath: string): {
  folders: string[]
  fileName: string
} {
  const normalized = filePath.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!normalized) {
    return { folders: [], fileName: filePath || '/' }
  }
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 1) {
    return { folders: [], fileName: parts[0] }
  }
  return {
    folders: parts.slice(0, -1),
    fileName: parts[parts.length - 1],
  }
}

export function EditorFileBreadcrumb({ filePath }: { filePath: string }) {
  const { folders, fileName } = parseFilePath(filePath)

  return (
    <nav className="playground__editorBreadcrumb" aria-label="Путь к файлу">
      <ol className="playground__editorBreadcrumbList">
        {folders.map((segment, index) => (
          <li
            key={`${index}-${segment}`}
            className="playground__editorBreadcrumbItem"
          >
            <span
              className="playground__editorBreadcrumbFolder"
              title={segment}
            >
              {segment}
            </span>
            <NavigateNextRoundedIcon
              className="playground__editorBreadcrumbSep"
              aria-hidden
            />
          </li>
        ))}
        <li className="playground__editorBreadcrumbItem playground__editorBreadcrumbItem--file">
          <FileTypeIcon filePath={filePath} />
          <span className="playground__editorBreadcrumbFile" title={fileName}>
            {fileName}
          </span>
        </li>
      </ol>
    </nav>
  )
}
