import { JobStatus } from './JobStatus.js';

export interface Task {
  id: string;
  createdAt: number;
  startedAt?: number; // <--- Add this
  model: string;
  prompt: string;
  status: JobStatus;
  chatUrl?: string;
  result?: string;
  error?: string;
}
