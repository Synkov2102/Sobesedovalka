export type TaskPresetFile = {
  path: string
  content: string
}

export type TaskPreset = {
  id: string
  title: string
  description: string
  files: Record<string, string>
  folders: string[]
  createdAt: string
  updatedAt: string
}

export type MainTab = 'rooms' | 'presets'

export type CollabRoomSummary = {
  roomId: string
  title: string
  createdAt: string
  updatedAt: string
}

export type CollabPasteEvent = {
  clientId: string
  displayName: string
  path: string
  content: string
  fileContent: string
  contentLength: number
  truncated: boolean
  insertStartOffset: number
  insertEndOffset: number
  line: number
  col: number
  createdAt: string
}

export type CollabPageLeaveEvent = {
  clientId: string
  displayName: string
  createdAt: string
}

export type AuthUser = {
  id: string
  email?: string
  phone?: string
}

export type AuthLoginResponse = {
  accessToken: string
  user: AuthUser
}
