import type { CollabPeerDTO } from '../../../collab/collab.types'
import { normalizeSandpackFilePath } from '../../../collab/sandpackPaths'

export function buildPeersByActiveFile(
  collabPeers: CollabPeerDTO[],
): Map<string, CollabPeerDTO[]> {
  const m = new Map<string, CollabPeerDTO[]>()

  for (const p of collabPeers) {
    const f = normalizeSandpackFilePath(p.activeFile)
    if (!f) {
      continue
    }
    const list = m.get(f)
    if (list) {
      list.push(p)
    } else {
      m.set(f, [p])
    }
  }

  for (const list of m.values()) {
    list.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
    )
  }

  return m
}

