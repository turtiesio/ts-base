// src/history.ts

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import logger from './utils/logger.js';
import { ulid } from 'ulid';

export enum JobStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Completed = 'completed',
  Failed = 'failed',
}

export interface Task {
  id: string;
  createdAt: number;
  model: string;
  prompt: string;
  status: string;
  chatUrl?: string;
  result?: string;
}

export interface TaskRecord extends Task {
  id: string;
  createdAt: number;
  status: JobStatus;
  result?: string;
  error?: string;
  chatUrl?: string; // optional link to the conversation
  saveToHistory: () => Promise<void>;
}

// Directory to store task JSON
const HISTORY_DIR = path.join(process.cwd(), '.history');

export async function ensureHistoryDir(): Promise<void> {
  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
  } catch (err) {
    logger.debug('History dir already exists or cannot be created');
  }
}

/**
 * Create a new TaskRecord from user input
 */
export function createTaskRecord(
  model: Task['model'],
  prompt: string,
): TaskRecord {
  const id = ulid();
  const now = Date.now();

  const record: TaskRecord = {
    id,
    createdAt: now,
    status: JobStatus.Pending,
    model,
    prompt,
    saveToHistory: async function () {
      await saveTaskRecord(this);
    },
  };
  return record;
}

/**
 * Save TaskRecord to a JSON file (filename starts with timestamp).
 */
export async function saveTaskRecord(task: TaskRecord) {
  await ensureHistoryDir();
  const dtString = new Date(task.createdAt).toISOString().replaceAll(':', '-');
  const filename = `${dtString}--${task.id}.json`;
  const filePath = path.join(HISTORY_DIR, filename);
  const json = JSON.stringify(task, null, 2);
  await fs.writeFile(filePath, json, 'utf-8');
  logger.debug(`[history] Wrote to file: ${filePath}`);
}

/**
 * Return the entire list of tasks
 */
export async function listTasks(): Promise<Task[]> {
  await ensureHistoryDir();
  const files = await fs.readdir(HISTORY_DIR);
  return await Promise.all(
    files.map(async (file) => {
      const task = JSON.parse(
        await fs.readFile(path.join(HISTORY_DIR, file), 'utf-8'),
      );
      return task;
    }),
  );
}

/**
 * Return a single task
 */
export async function getTask(id: string): Promise<Task | undefined> {
  await ensureHistoryDir();
  const files = await fs.readdir(HISTORY_DIR);
  const file = files.find((f) => f.includes(id));
  if (!file) {
    return undefined;
  }

  const task = JSON.parse(
    await fs.readFile(path.join(HISTORY_DIR, file), 'utf-8'),
  );

  return task;
}
