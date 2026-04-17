import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Task } from './interfaces/task.interface';

@Injectable()
export class TasksService {
  private readonly tasks: Task[] = [];

  findAll(): Task[] {
    return [...this.tasks].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  create(title: string): Task {
    const task: Task = {
      id: randomUUID(),
      title,
      createdAt: new Date().toISOString(),
    };
    this.tasks.unshift(task);
    return task;
  }

  remove(id: string): void {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new NotFoundException('Task not found');
    }
    this.tasks.splice(index, 1);
  }
}
