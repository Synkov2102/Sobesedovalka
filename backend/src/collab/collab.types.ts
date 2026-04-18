export type RoomPeer = {
  displayName: string;
  activeFile: string;
  /** 0..359; same for all clients (from clientId at join). */
  hue?: number;
  /** sRGB hex from server, e.g. `#1a8f5c` — same model as UI accent. */
  colorHex?: string;
  /** Selection anchor (where selection started). */
  anchorLine: number;
  anchorCol: number;
  /** Selection head / caret (where selection ends). */
  headLine: number;
  headCol: number;
};
