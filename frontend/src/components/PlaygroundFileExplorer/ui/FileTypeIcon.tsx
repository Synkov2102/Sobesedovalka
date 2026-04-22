import { getFileIconSpec } from '../utils/fileIcon'

export function FileTypeIcon({ filePath }: { filePath: string }) {
  const spec = getFileIconSpec(filePath)

  return (
    <span
      className={`playground__fileTypeIcon playground__fileTypeIcon--${spec.tone}`}
      title={spec.title}
      aria-hidden="true"
    >
      {spec.label}
    </span>
  )
}

