import { GenericQueue } from './GenericQueue.js';
import { TaskRecord } from '../models/TaskRecord.js';
import { JobStatus } from '../models/JobStatus.js';
import logger from '../utils/logger.js';
import { getPage } from '../utils/puppeteer.js';
import { Provider } from './providers/Provider.js';

export class JobQueue {
  private queue: GenericQueue;
  private providersMap: Record<string, Provider> = {};

  constructor() {
    this.queue = new GenericQueue();

    this.queue.on('start', (jobId) => {
      logger.info({ jobId }, `[JobQueue] Job started`);
    });

    this.queue.on('done', (jobId) => {
      logger.info({ jobId }, `[JobQueue] Job finished`);
    });

    this.queue.on('error', ({ jobId, err }) => {
      logger.error({ jobId, err }, `[JobQueue] Job error`);
    });
  }

  public registerProvider(provider: Provider) {
    this.providersMap[provider.model] = provider;
  }

  public getProviders(): string[] {
    return Object.keys(this.providersMap);
  }

  public enqueueTask(task: TaskRecord) {
    task.saveToHistory();

    this.queue.add({
      id: task.id,
      execute: () => this.runTask(task),
    });
  }

  private async runTask(task: TaskRecord): Promise<void> {
    task.status = JobStatus.InProgress;
    task.startedAt = Date.now(); // Mark the time we start processing

    await task.saveToHistory();

    try {
      const provider = this.providersMap[task.model];
      if (!provider) {
        throw new Error(`No registered provider for model: ${task.model}`);
      }

      const page = await getPage();
      const result = await provider.runPrompt(page, task.prompt);

      task.result = result;
      task.status = JobStatus.Completed;
      task.chatUrl = page.url();

      await page.close();
    } catch (err) {
      task.status = JobStatus.Failed;
      task.error = String(err);
      logger.error({ jobId: task.id, err }, `[JobQueue] Job error`);
    } finally {
      await task.saveToHistory();
    }
  }
}
