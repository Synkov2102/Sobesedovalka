/** One Sandpack file per room (unique roomId + path). */
export type CollabFileDoc = {
  roomId: string;
  path: string;
  content: string;
  updatedAt: Date;
};

/** One explicit folder path per room (unique roomId + path). */
export type CollabFolderDoc = {
  roomId: string;
  path: string;
  updatedAt: Date;
};

/** One participant per room (unique roomId + clientId). */
export type CollabPeerDoc = {
  roomId: string;
  clientId: string;
  displayName: string;
  hue: number;
  colorHex?: string;
  activeFile: string;
  anchorLine: number;
  anchorCol: number;
  headLine: number;
  headCol: number;
  updatedAt: Date;
};

/** Room metadata (created on first activity). */
export type CollabRoomDoc = {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};
