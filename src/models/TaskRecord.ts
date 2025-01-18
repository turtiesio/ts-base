import { Task } from './Task.js';

export interface TaskRecord extends Task {
  saveToHistory: () => Promise<void>;
}
