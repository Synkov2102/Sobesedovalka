import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/** Persists per-room file maps under `data/collab/` so reconnects survive server restarts. */
@Injectable()
export class CollabPersistenceService {
  private readonly logger = new Logger(CollabPersistenceService.name);
  private readonly dir = join(process.cwd(), 'data', 'collab');

  safeRoomSegment(room: string): string {
    const s = room.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    return s.length > 0 ? s : 'room';
  }

  private filePath(room: string): string {
    return join(this.dir, `${this.safeRoomSegment(room)}.json`);
  }

  async loadRoom(room: string): Promise<Record<string, string>> {
    try {
      await mkdir(this.dir, { recursive: true });
      const raw = await readFile(this.filePath(room), 'utf8');
      const data: unknown = JSON.parse(raw);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
          if (typeof k === 'string' && typeof v === 'string') {
            out[k] = v;
          }
        }
        return out;
      }
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code !== 'ENOENT') {
        this.logger.warn(`loadRoom(${room}): ${String(e)}`);
      }
    }
    return {};
  }

  async saveRoom(room: string, files: Record<string, string>): Promise<void> {
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(this.filePath(room), JSON.stringify(files), 'utf8');
    } catch (e) {
      this.logger.error(`saveRoom(${room}): ${String(e)}`);
    }
  }
}
