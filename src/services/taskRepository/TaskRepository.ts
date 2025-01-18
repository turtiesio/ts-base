import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ulid } from 'ulid';
import { Task } from '../../models/Task.js';
import { TaskRecord } from '../../models/TaskRecord.js';
import { JobStatus } from '../../models/JobStatus.js';
import logger from '../../utils/logger.js';

const HISTORY_DIR = path.join(process.cwd(), '.history');

// In-memory storage
const tasksInMemory: Record<string, Task> = {};

/**
 * Initialize the repository on startup:
 * - Create the .history folder
 * - Load existing tasks from disk into memory
 */
async function initRepoIfNeeded() {
  // Only load once
  if (Object.keys(tasksInMemory).length > 0) return;

  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
  } catch (err) {
    logger.warn('Unable to create or already existing .history folder');
  }

  // Load existing JSON files from .history
  const files = await fs.readdir(HISTORY_DIR);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const jsonStr = await fs.readFile(path.join(HISTORY_DIR, file), 'utf-8');
    try {
      const task: Task = JSON.parse(jsonStr);
      tasksInMemory[task.id] = task;
    } catch (err) {
      logger.warn(`Skipping invalid file: ${file}`);
    }
  }
}

/**
 * Save a single task to disk (for persistence)
 */
async function saveTaskToDisk(task: Task) {
  const dtString = new Date(task.createdAt).toISOString().replaceAll(':', '-');
  const filename = `${dtString}--${task.id}.json`;
  const filePath = path.join(HISTORY_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(task, null, 2), 'utf-8');
}

/**
 * Create a new TaskRecord
 */
export async function createTaskRecord(
  model: string,
  prompt: string,
  title?: string,
): Promise<TaskRecord> {
  await initRepoIfNeeded();
  const id = ulid();
  const now = Date.now();

  // Basic task
  const task: Task = {
    id,
    createdAt: now,
    model,
    prompt,
    title,
    status: JobStatus.Pending,
  };

  // Store it in memory
  tasksInMemory[id] = task;

  // Return a TaskRecord (with a save method)
  const record: TaskRecord = {
    ...task,
    async saveToHistory() {
      // Keep the in-memory object up to date
      tasksInMemory[this.id] = { ...this };
      // Also persist to disk (optional)
      await saveTaskToDisk(this);
    },
  };
  return record;
}

/**
 * Return all tasks, sorted by creation date descending
 */
export async function listAllTasks(): Promise<Task[]> {
  await initRepoIfNeeded();
  return Object.values(tasksInMemory).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Retrieve a single task by ID
 */
export async function getTaskById(id: string): Promise<Task | undefined> {
  await initRepoIfNeeded();
  return tasksInMemory[id];
}
