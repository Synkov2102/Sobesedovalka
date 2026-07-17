import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CollabMongoRepository } from '../collab/collab-mongo.repository';
import { normalizeSandpackFilePath } from '../collab/sandpack-paths';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateTaskPresetDto } from './dto/create-task-preset.dto';
import { UpdateTaskPresetDto } from './dto/update-task-preset.dto';
import { TaskPresetsRepository } from './task-presets.repository';
import type {
  TaskPresetDoc,
  TaskPresetFileMap,
  TaskPresetView,
  TaskPresetVisibility,
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
    @Inject(forwardRef(() => OrganizationsService))
    private readonly organizations: OrganizationsService,
  ) {}

  async list(userId: string): Promise<TaskPresetView[]> {
    const orgIds = await this.organizations.listOrganizationIdsForUser(userId);
    const docs = await this.repo.listVisibleToUser(userId, orgIds);
    const nameByOrg = await this.organizations.getOrganizationNames(
      docs
        .map((d) => d.organizationId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );
    return docs.map((doc) =>
      this.toView(doc, userId, nameByOrg.get(doc.organizationId ?? '')),
    );
  }

  async getOne(userId: string, id: string): Promise<TaskPresetView> {
    const doc = await this.requireReadablePreset(userId, id);
    const organizationName = doc.organizationId
      ? (await this.organizations.getOrganizationNames([doc.organizationId])).get(
          doc.organizationId,
        )
      : undefined;
    return this.toView(doc, userId, organizationName);
  }

  async create(
    userId: string,
    dto: CreateTaskPresetDto,
  ): Promise<TaskPresetView> {
    const normalized = this.normalizePresetFiles(dto.files);
    const solutionFiles = this.normalizeOptionalSolutionFiles(
      dto.solutionFiles,
      normalized.files,
    );
    const sharing = await this.resolveSharing(userId, {
      visibility: dto.visibility ?? 'private',
      organizationId: dto.organizationId,
    });

    const now = new Date().toISOString();
    const doc: TaskPresetDoc = {
      _id: randomUUID(),
      userId,
      title: dto.title,
      description: dto.description ?? '',
      files: normalized.files,
      folders: normalized.folders,
      visibility: sharing.visibility,
      ...(sharing.organizationId
        ? { organizationId: sharing.organizationId }
        : {}),
      solutionFiles,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(doc);
    const organizationName = doc.organizationId
      ? (await this.organizations.getOrganizationNames([doc.organizationId])).get(
          doc.organizationId,
        )
      : undefined;
    return this.toView(doc, userId, organizationName);
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

    let solutionFiles = current.solutionFiles ?? {};
    if (dto.solutionFiles) {
      solutionFiles = this.normalizeOptionalSolutionFiles(
        dto.solutionFiles,
        files,
      );
    } else {
      this.assertNoPathOverlap(files, solutionFiles);
    }

    const sharing = await this.resolveSharing(userId, {
      visibility: dto.visibility ?? current.visibility ?? 'private',
      organizationId:
        dto.organizationId !== undefined
          ? dto.organizationId
          : current.organizationId,
    });

    const updatedAt = new Date().toISOString();
    const updated: TaskPresetDoc = {
      ...current,
      title: dto.title ?? current.title,
      description: dto.description ?? current.description,
      files,
      folders,
      visibility: sharing.visibility,
      solutionFiles,
      updatedAt,
    };
    if (sharing.organizationId) {
      updated.organizationId = sharing.organizationId;
    } else {
      delete updated.organizationId;
    }

    const patch: Partial<
      Omit<TaskPresetDoc, '_id' | 'userId' | 'createdAt'>
    > = {
      title: updated.title,
      description: updated.description,
      files: updated.files,
      folders: updated.folders,
      visibility: updated.visibility,
      solutionFiles: updated.solutionFiles,
      updatedAt,
    };
    if (sharing.organizationId) {
      patch.organizationId = sharing.organizationId;
    }

    await this.repo.updateForUser(
      id,
      userId,
      patch,
      sharing.organizationId ? [] : ['organizationId'],
    );

    const organizationName = updated.organizationId
      ? (
          await this.organizations.getOrganizationNames([
            updated.organizationId,
          ])
        ).get(updated.organizationId)
      : undefined;
    return this.toView(updated, userId, organizationName);
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.repo.deleteForUser(id, userId);
    if (!deleted) {
      throw new NotFoundException('Preset not found');
    }
  }

  async clone(userId: string, id: string): Promise<TaskPresetView> {
    const source = await this.requireReadablePreset(userId, id);
    const now = new Date().toISOString();
    const doc: TaskPresetDoc = {
      _id: randomUUID(),
      userId,
      title: `${source.title} (copy)`,
      description: source.description,
      files: { ...source.files },
      folders: [...source.folders],
      visibility: 'private',
      solutionFiles: { ...(source.solutionFiles ?? {}) },
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(doc);
    return this.toView(doc, userId);
  }

  async collabRoomReady(roomId: string): Promise<{ ready: boolean }> {
    const safe = roomId
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 64);
    if (!safe) {
      return { ready: false };
    }
    const ready = await this.collabRepo.roomHasFiles(safe);
    return { ready };
  }

  async startRoom(userId: string, id: string): Promise<{ roomId: string }> {
    const preset = await this.requireReadablePreset(userId, id);
    const roomId = `preset-${randomUUID()}`;
    // Seed only starter files — solutions stay on the preset for the host.
    await this.collabRepo.seedRoom(roomId, preset.files, preset.folders);
    await this.collabRepo.setRoomOwnership(roomId, {
      ownerUserId: userId,
      title: preset.title,
      sourcePresetId: preset._id,
    });
    return { roomId };
  }

  async getRoomSolution(
    userId: string,
    roomId: string,
  ): Promise<{ solutionFiles: TaskPresetFileMap; title: string }> {
    const safe = roomId
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 64);
    if (!safe) {
      throw new NotFoundException('Room not found');
    }

    const belongs = await this.collabRepo.roomBelongsToOwner(safe, userId);
    if (!belongs) {
      throw new ForbiddenException('Only the room owner can view the solution');
    }

    const room = await this.collabRepo.findRoom(safe);
    if (!room?.sourcePresetId) {
      throw new NotFoundException('No solution linked to this room');
    }

    const preset = await this.repo.findById(room.sourcePresetId);
    if (!preset) {
      throw new NotFoundException('Source preset not found');
    }

    return {
      solutionFiles: { ...(preset.solutionFiles ?? {}) },
      title: preset.title,
    };
  }

  private async requireReadablePreset(
    userId: string,
    id: string,
  ): Promise<TaskPresetDoc> {
    const doc = await this.repo.findById(id);
    if (!doc) {
      throw new NotFoundException('Preset not found');
    }
    if (doc.userId === userId) {
      return this.withDefaults(doc);
    }
    if (
      doc.visibility === 'organization' &&
      doc.organizationId &&
      (await this.organizations.isMember(doc.organizationId, userId))
    ) {
      return this.withDefaults(doc);
    }
    throw new NotFoundException('Preset not found');
  }

  private async resolveSharing(
    userId: string,
    input: {
      visibility: TaskPresetVisibility;
      organizationId?: string;
    },
  ): Promise<{ visibility: TaskPresetVisibility; organizationId?: string }> {
    if (input.visibility === 'private') {
      return { visibility: 'private' };
    }

    const organizationId = input.organizationId?.trim();
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId is required for organization visibility',
      );
    }
    await this.organizations.assertMember(organizationId, userId);
    return { visibility: 'organization', organizationId };
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
      this.getFoldersForFile(path).forEach((folderPath) =>
        folders.add(folderPath),
      );
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

  private normalizeOptionalSolutionFiles(
    input: Array<{ path: string; content: string }> | undefined,
    starterFiles: TaskPresetFileMap,
  ): TaskPresetFileMap {
    if (!input || input.length === 0) {
      return {};
    }
    const solutionFiles: TaskPresetFileMap = {};
    for (const entry of input) {
      const path = normalizeSandpackFilePath(entry.path);
      if (!path) {
        throw new BadRequestException('Invalid solution file path');
      }
      solutionFiles[path] = entry.content;
    }
    this.assertNoPathOverlap(starterFiles, solutionFiles);
    return solutionFiles;
  }

  private assertNoPathOverlap(
    files: TaskPresetFileMap,
    solutionFiles: TaskPresetFileMap,
  ): void {
    for (const path of Object.keys(solutionFiles)) {
      if (Object.prototype.hasOwnProperty.call(files, path)) {
        throw new BadRequestException(
          `Path "${path}" cannot be both a starter and a solution file`,
        );
      }
    }
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

  private withDefaults(doc: TaskPresetDoc): TaskPresetDoc {
    return {
      ...doc,
      visibility: doc.visibility ?? 'private',
      solutionFiles: doc.solutionFiles ?? {},
    };
  }

  private toView(
    doc: TaskPresetDoc,
    userId: string,
    organizationName?: string,
  ): TaskPresetView {
    const normalized = this.withDefaults(doc);
    const view: TaskPresetView = {
      id: normalized._id,
      title: normalized.title,
      description: normalized.description,
      files: normalized.files,
      folders: [...normalized.folders],
      visibility: normalized.visibility,
      solutionFiles: { ...normalized.solutionFiles },
      access: normalized.userId === userId ? 'owner' : 'shared',
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
    };
    if (normalized.organizationId) {
      view.organizationId = normalized.organizationId;
    }
    if (organizationName) {
      view.organizationName = organizationName;
    }
    return view;
  }
}
