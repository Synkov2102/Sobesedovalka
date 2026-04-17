export type RoomPeer = {
  displayName: string;
  activeFile: string;
  /** Selection anchor (where selection started). */
  anchorLine: number;
  anchorCol: number;
  /** Selection head / caret (where selection ends). */
  headLine: number;
  headCol: number;
};
