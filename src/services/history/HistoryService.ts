import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Task } from '../../models/Task.js';
import { TaskRecord } from '../../models/TaskRecord.js';
import { JobStatus } from '../../models/JobStatus.js';
import { ulid } from 'ulid';
import logger from '../../utils/logger.js';

const HISTORY_DIR = path.join(process.cwd(), '.history');

async function ensureHistoryDir(): Promise<void> {
  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
  } catch (err) {
    logger.debug('History dir creation not needed or failed');
  }
}

/**
 * Factory to create a new TaskRecord
 */
export async function createTaskRecord(
  model: string,
  prompt: string,
): Promise<TaskRecord> {
  await ensureHistoryDir();
  const now = Date.now();
  const id = ulid();

  const record: TaskRecord = {
    id,
    createdAt: now,
    model,
    prompt,
    status: JobStatus.Pending,
    saveToHistory: async function () {
      await saveTaskRecord(this);
    },
  };
  return record;
}

/**
 * Save TaskRecord to disk
 */
export async function saveTaskRecord(task: TaskRecord) {
  await ensureHistoryDir();
  const dtString = new Date(task.createdAt).toISOString().replaceAll(':', '-');
  const filename = `${dtString}--${task.id}.json`;
  const filePath = path.join(HISTORY_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(task, null, 2), 'utf-8');
}

/**
 * Return all tasks, sorted by creation date descending
 */
export async function listAllTasks(): Promise<Task[]> {
  await ensureHistoryDir();
  const files = await fs.readdir(HISTORY_DIR);
  const tasks: Task[] = [];

  for (const file of files) {
    const jsonStr = await fs.readFile(path.join(HISTORY_DIR, file), 'utf-8');
    const task = JSON.parse(jsonStr);
    tasks.push(task);
  }

  return tasks.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Return filtered tasks, excluding canceled and completed tasks
 */
export async function listActiveTasks(): Promise<Task[]> {
  const allTasks = await listAllTasks();
  return allTasks.filter(
    (t) => t.status !== JobStatus.Canceled && t.status !== JobStatus.Completed,
  );
}

/**
 * Retrieve a single task by ID
 */
export async function getTaskById(id: string): Promise<Task | undefined> {
  await ensureHistoryDir();
  const files = await fs.readdir(HISTORY_DIR);
  const match = files.find((f) => f.includes(id));
  if (!match) return undefined;
  const jsonStr = await fs.readFile(path.join(HISTORY_DIR, match), 'utf-8');
  return JSON.parse(jsonStr);
}
