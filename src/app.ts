import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import logger from './utils/logger.js';
import {
  handleGetIndex,
  handleGetTasksPartial,
  handlePostTask,
  handleGetTaskMarkdown,
} from './controllers/tasksController.js';

const app = new Hono();

// Routes
app.get('/', handleGetIndex);
app.get('/tasks/partial', handleGetTasksPartial);
app.post('/tasks', handlePostTask);
app.get('/tasks/:id/markdown', handleGetTaskMarkdown);

serve({ fetch: app.fetch, port: 3000 });
logger.info('Server started on http://localhost:3000');
