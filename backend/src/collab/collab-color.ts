import { createHash } from 'crypto';
import type { RoomPeer } from './collab.types';

/** 0..359 */
export function normHue(h: number): number {
  let x = Math.floor(h) % 360;
  if (x < 0) {
    x += 360;
  }
  return x;
}

/** Stable seed 0..359 from clientId (better spread than char-code loop). */
export function hueFromClientId(id: string): number {
  const buf = createHash('sha256').update(id, 'utf8').digest().subarray(0, 2);
  return buf.readUInt16BE(0) % 360;
}

/** Coprime with 360 → visits many distinct hues before repeating. */
const HUE_COLLISION_STEP = 37;

/**
 * Pick a hue not already used in the room (other participants).
 * Starts from hash(clientId), then steps until free.
 */
export function pickHueUniqueInRoom(
  used: ReadonlySet<number>,
  clientId: string,
): number {
  const start = normHue(hueFromClientId(clientId));
  let h = start;
  for (let i = 0; i < 400; i++) {
    if (!used.has(h)) {
      return h;
    }
    h = (h + HUE_COLLISION_STEP) % 360;
  }
  return start;
}

/** sRGB HSL (CSS `hsl(H 72% 40%)`) → 0..255. H degrees; S,L 0..1. */
export function hslToRgbForPeer(
  hueDeg: number,
  S = 0.72,
  L = 0.4,
): { r: number; g: number; b: number } {
  const h = (((hueDeg % 360) + 360) % 360) / 360;
  if (S === 0) {
    const v = Math.round(L * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }
    if (t < 1 / 2) {
      return q;
    }
    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }
    return p;
  };
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

function byteToHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

/** Lowercase `#rrggbb` for presence UI. */
export function peerHexFromHue(hueDeg: number): string {
  const { r, g, b } = hslToRgbForPeer(normHue(hueDeg));
  return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
}

/**
 * Keep `hue` and `colorHex` in sync on the in-memory peer.
 * If `hue` is missing (legacy row), seeds from `clientId`.
 */
export function syncPeerPresenceColors(peer: RoomPeer, clientId: string): void {
  if (peer.hue == null) {
    peer.hue = normHue(hueFromClientId(clientId));
  } else {
    peer.hue = normHue(peer.hue);
  }
  peer.colorHex = peerHexFromHue(peer.hue);
}
