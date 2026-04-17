export type CollabPeerDTO = {
  clientId: string
  displayName: string
  activeFile: string
  /** Caret (head); same as headLine/headCol when present */
  line: number
  col: number
  anchorLine?: number
  anchorCol?: number
  headLine?: number
  headCol?: number
}
