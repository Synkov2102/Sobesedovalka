export type TaskPresetFileMap = Record<string, string>;

export type TaskPresetVisibility = 'private' | 'organization';

export type TaskPresetAccess = 'owner' | 'shared';

export type TaskPresetDoc = {
  _id: string;
  userId: string;
  title: string;
  description: string;
  files: TaskPresetFileMap;
  folders: string[];
  visibility: TaskPresetVisibility;
  organizationId?: string;
  solutionFiles: TaskPresetFileMap;
  createdAt: string;
  updatedAt: string;
};

export type TaskPresetView = {
  id: string;
  title: string;
  description: string;
  files: TaskPresetFileMap;
  folders: string[];
  visibility: TaskPresetVisibility;
  organizationId?: string;
  organizationName?: string;
  solutionFiles: TaskPresetFileMap;
  access: TaskPresetAccess;
  createdAt: string;
  updatedAt: string;
};
