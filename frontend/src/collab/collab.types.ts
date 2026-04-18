export type CollabWelcomePayload = {
  clientId: string
  displayName: string
  /** 0..359 from server */
  hue: number
  /** `#rrggbb` from server */
  colorHex: string
}

export type CollabPeerDTO = {
  clientId: string
  displayName: string
  activeFile: string
  /** 0..359 from server (`collab-roster`) */
  hue?: number
  /** `#rrggbb` from server — source of truth for presence color */
  colorHex?: string
  /** Caret (head); same as headLine/headCol when present */
  line: number
  col: number
  anchorLine?: number
  anchorCol?: number
  headLine?: number
  headCol?: number
}
