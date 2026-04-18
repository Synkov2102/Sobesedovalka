import type { CollabPeerDTO } from './collab.types'

const FALLBACK_HEX = '#64748b'

function parseHex6(hex: string): { r: number; g: number; b: number } | null {
  const t = hex.trim()
  const m = /^#?([a-fA-F0-9]{6})$/.exec(t)
  if (!m) {
    return null
  }
  const s = m[1]
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  }
}

/** Normalize server `colorHex` to lowercase `#rrggbb`. */
export function normalizePeerColorHexWire(h: unknown): string | undefined {
  if (typeof h !== 'string') {
    return undefined
  }
  const t = h.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) {
    return t.toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(t)) {
    return `#${t.toLowerCase()}`
  }
  return undefined
}

export function normalizePeerHueWire(h: unknown): number | undefined {
  if (typeof h === 'number' && Number.isFinite(h)) {
    return h
  }
  if (typeof h === 'string' && h.trim() !== '') {
    const n = Number(h)
    if (Number.isFinite(n)) {
      return n
    }
  }
  return undefined
}

export type PeerRgb = { r: number; g: number; b: number }

/** sRGB from server `colorHex` only. */
export function peerAccentRgb(p: Pick<CollabPeerDTO, 'colorHex'>): PeerRgb {
  const hex = normalizePeerColorHexWire(p.colorHex)
  if (hex) {
    const rgb = parseHex6(hex)
    if (rgb) {
      return rgb
    }
  }
  return parseHex6(FALLBACK_HEX)!
}

/** `r g b` for `rgb(var(--peer-rgb) / α)` */
export function peerRgbSpace(p: Pick<CollabPeerDTO, 'colorHex'>): string {
  const { r, g, b } = peerAccentRgb(p)
  return `${r} ${g} ${b}`
}

export function peerAccentRgbCss(p: Pick<CollabPeerDTO, 'colorHex'>): string {
  const { r, g, b } = peerAccentRgb(p)
  return `rgb(${r},${g},${b})`
}

export function peerAccentRgbaCss(
  p: Pick<CollabPeerDTO, 'colorHex'>,
  alpha: number,
): string {
  const { r, g, b } = peerAccentRgb(p)
  const a = Math.min(1, Math.max(0, alpha))
  return `rgba(${r},${g},${b},${a})`
}
