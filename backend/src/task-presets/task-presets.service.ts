import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CollabMongoRepository } from '../collab/collab-mongo.repository';
import { normalizeSandpackFilePath } from '../collab/sandpack-paths';
import { CreateTaskPresetDto } from './dto/create-task-preset.dto';
import { UpdateTaskPresetDto } from './dto/update-task-preset.dto';
import { TaskPresetsRepository } from './task-presets.repository';
import type {
  TaskPresetDoc,
  TaskPresetFileMap,
  TaskPresetView,
} from './task-presets.types';

function normalizeFolderPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/');
  if (!normalized) {
    return '';
  }
  const trimmed = normalized.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed ? `/${trimmed}` : '';
}

@Injectable()
export class TaskPresetsService {
  constructor(
    private readonly repo: TaskPresetsRepository,
    private readonly collabRepo: CollabMongoRepository,
  ) {}

  async list(userId: string): Promise<TaskPresetView[]> {
    const docs = await this.repo.listByUser(userId);
    return docs.map((doc) => this.toView(doc));
  }

  async create(
    userId: string,
    dto: CreateTaskPresetDto,
  ): Promise<TaskPresetView> {
    const normalized = this.normalizePresetFiles(dto.files);
    const now = new Date().toISOString();
    const doc: TaskPresetDoc = {
      _id: randomUUID(),
      userId,
      title: dto.title,
      description: dto.description ?? '',
      files: normalized.files,
      folders: normalized.folders,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(doc);
    return this.toView(doc);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTaskPresetDto,
  ): Promise<TaskPresetView> {
    const current = await this.repo.findByIdForUser(id, userId);
    if (!current) {
      throw new NotFoundException('Preset not found');
    }

    let files = current.files;
    let folders = current.folders;
    if (dto.files) {
      const normalized = this.normalizePresetFiles(dto.files);
      files = normalized.files;
      folders = normalized.folders;
    }

    const updated: TaskPresetDoc = {
      ...current,
      title: dto.title ?? current.title,
      description: dto.description ?? current.description,
      files,
      folders,
      updatedAt: new Date().toISOString(),
    };

    await this.repo.updateForUser(id, userId, {
      title: updated.title,
      description: updated.description,
      files: updated.files,
      folders: updated.folders,
      updatedAt: updated.updatedAt,
    });

    return this.toView(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.repo.deleteForUser(id, userId);
    if (!deleted) {
      throw new NotFoundException('Preset not found');
    }
  }

  async collabRoomReady(roomId: string): Promise<{ ready: boolean }> {
    const safe = roomId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    if (!safe) {
      return { ready: false };
    }
    const ready = await this.collabRepo.roomHasFiles(safe);
    return { ready };
  }

  async startRoom(
    userId: string,
    id: string,
  ): Promise<{ roomId: string }> {
    const preset = await this.repo.findByIdForUser(id, userId);
    if (!preset) {
      throw new NotFoundException('Preset not found');
    }
    const roomId = `preset-${randomUUID()}`;
    await this.collabRepo.seedRoom(roomId, preset.files, preset.folders);
    return { roomId };
  }

  private normalizePresetFiles(
    input: Array<{ path: string; content: string }>,
  ): { files: TaskPresetFileMap; folders: string[] } {
    const files: TaskPresetFileMap = {};
    const folders = new Set<string>();

    for (const entry of input) {
      const path = normalizeSandpackFilePath(entry.path);
      if (!path) {
        throw new BadRequestException('Invalid file path');
      }
      files[path] = entry.content;
      this.getFoldersForFile(path).forEach((folderPath) => folders.add(folderPath));
    }

    const paths = Object.keys(files);
    if (paths.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    return {
      files,
      folders: Array.from(folders).sort((a, b) => a.localeCompare(b)),
    };
  }

  private getFoldersForFile(path: string): string[] {
    const parts = path
      .replace(/^\/+/, '')
      .split('/')
      .slice(0, -1)
      .filter(Boolean);
    const out: string[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const folderPath = normalizeFolderPath(parts.slice(0, i + 1).join('/'));
      if (folderPath) {
        out.push(folderPath);
      }
    }
    return out;
  }

  private toView(doc: TaskPresetDoc): TaskPresetView {
    return {
      id: doc._id,
      title: doc.title,
      description: doc.description,
      files: doc.files,
      folders: [...doc.folders],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
