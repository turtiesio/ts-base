import { EventEmitter } from 'events';

export interface QueueJob {
  id: string;
  execute: () => Promise<void>;
}

export class GenericQueue extends EventEmitter {
  private concurrency = 5;
  private runningCount = 0;
  private queue: QueueJob[] = [];

  constructor(concurrency = 5) {
    super();
    this.concurrency = concurrency;
  }

  public add(job: QueueJob): void {
    this.queue.push(job);
    this.processNext();
  }

  private processNext(): void {
    if (this.runningCount >= this.concurrency) return;
    const nextJob = this.queue.shift();
    if (!nextJob) return;
    this.runningCount += 1;

    this.emit('start', nextJob.id);

    nextJob
      .execute()
      .then(() => {
        this.emit('done', nextJob.id);
      })
      .catch((err) => {
        this.emit('error', { id: nextJob.id, err });
      })
      .finally(() => {
        this.runningCount -= 1;
        this.processNext();
      });
  }
}
