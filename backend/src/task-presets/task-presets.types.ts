export type TaskPresetFileMap = Record<string, string>;

export type TaskPresetDoc = {
  _id: string;
  userId: string;
  title: string;
  description: string;
  files: TaskPresetFileMap;
  folders: string[];
  createdAt: string;
  updatedAt: string;
};

export type TaskPresetView = {
  id: string;
  title: string;
  description: string;
  files: TaskPresetFileMap;
  folders: string[];
  createdAt: string;
  updatedAt: string;
};
