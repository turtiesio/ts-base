// src/queue.ts

import { promptChatGPT } from './runJourney.js';
import logger from './utils/logger.js';
import { JobStatus, TaskRecord } from './history.js';
import { getPage } from './utils/puppeteer.js';

// In-memory store of tasks
// - Real usage could store in DB, but here we keep it simple
const tasksMap = new Map<string, TaskRecord>();

// Add a new task to queue & immediately start it (parallel)
export async function enqueueTask(task: TaskRecord) {
  tasksMap.set(task.id, task);
  runTask(task).catch((err) => {
    logger.error({ err }, '[queue] Error running task');
  });
  return task;
}

// Return a list of tasks, sorted desc by creationTime
export function listTasks(): TaskRecord[] {
  const items = [...tasksMap.values()];
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

// Return a single task
export function getTask(taskId: string): TaskRecord | undefined {
  return tasksMap.get(taskId);
}

// Core logic: run the prompt in parallel (i.e. no concurrency limit here)
async function runTask(task: TaskRecord) {
  const TIMEOUT_20_MIN = 1000 * 60 * 20; // 20 minutes

  // Mark as in-progress
  task.status = JobStatus.InProgress;
  tasksMap.set(task.id, task);

  try {
    // If the model is "o1-pro", we can attach a 20-min time limit
    const timeoutMs = task.model === 'o1-pro' ? TIMEOUT_20_MIN : 0;

    // Open a new tab (page)
    const page = await getPage();

    // Optionally track the “chat URL” after model-switching. We'll do it after the first goto.
    await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });
    const chatUrl = page.url();
    task.chatUrl = chatUrl;
    tasksMap.set(task.id, task);

    // Actually run the prompt logic, with an optional timeout
    const finalPromise = promptChatGPT(page, {
      prompt: task.prompt,
      model: task.model as any,
    });

    let result: string;
    if (timeoutMs > 0) {
      result = (await Promise.race([
        finalPromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Task timed out.')), timeoutMs),
        ),
      ])) as string;
    } else {
      result = await finalPromise;
    }

    // Write the final result
    task.result = result;
    task.status = JobStatus.Completed;
    // Let the user see the final conversation URL, in case ChatGPT changed it after the conversation
    task.chatUrl = page.url();

    // Close just the tab
    await page.close();
  } catch (err) {
    logger.error({ err }, '[queue] runTask error');
    task.status = JobStatus.Failed;
    task.error = String(err);
  } finally {
    // Mark updated in map
    tasksMap.set(task.id, task);

    // Persist to .history
    await task.saveToHistory();
  }
}
