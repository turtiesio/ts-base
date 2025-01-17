// src/main.ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import logger from './utils/logger.js';

import { createTaskRecord, listTasks, getTask } from './history.js';
import { enqueueTask } from './queue.js';

/**
 * HTMX: Return the <tbody> portion for the tasks table
 */
async function renderTasksTableRows() {
  const tasks = await listTasks();
  return tasks
    .map((t) => {
      // If there's a result, show a "Download" button
      const downloadBtn = t.result
        ? `<a href="/tasks/${t.id}/download" target="_blank">Download</a>`
        : '—';

      const chatUrlLink = t.chatUrl
        ? `<a href="${t.chatUrl}" target="_blank">Open Chat</a>`
        : '—';

      return `
      <tr>
        <td>${new Date(t.createdAt).toLocaleString()}</td>
        <td>${t.model}</td>
        <td>${t.status}</td>
        <td>${chatUrlLink}</td>
        <td>${downloadBtn}</td>
      </tr>
      `;
    })
    .join('');
}

const app = new Hono();

// Show the full page with the tasks table & form
app.get('/', async (c) => {
  const rowsHtml = await renderTasksTableRows();

  // Basic HTML with htmx
  // We have a form that posts to /tasks. We also have a button to refresh the table.
  return c.html(`
  <html>
    <head>
      <title>Prompt ChatGPT/Claude</title>
      <script src="https://unpkg.com/htmx.org@1.9.2"></script>
    </head>
    <body>
      <h1>Parallel Job Queue Demo</h1>

      <form hx-post="/tasks" hx-target="#tasks-tbody" hx-swap="innerHTML">
        <label for="prompt">Prompt:</label><br/>
        <textarea id="prompt" name="prompt" rows="15" cols="150"></textarea><br/><br/>

        <label for="model">Model:</label>
        <select name="model" id="model">
          <option value="o1">o1</option>
          <option value="o1-pro">o1-pro</option>
          <option value="o1-mini">o1-mini</option>
          <option value="gpt-4o">gpt-4o</option>
        </select><br/><br/>

        <button type="submit">Add Task</button>
      </form>

      <br/>
      <button
        hx-get="/tasks/partial"
        hx-trigger="every 2s"
        hx-target="#tasks-tbody"
        hx-swap="innerHTML"
      >
        Refresh Tasks
      </button>

      <h2>Tasks</h2>
      <table border="1" width="80%">
        <thead>
          <tr>
            <th>Created</th>
            <th>Model</th>
            <th>Status</th>
            <th>Chat URL</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody id="tasks-tbody">
          ${rowsHtml}
        </tbody>
      </table>
    </body>
  </html>
  `);
});

// Return just the <tbody> of tasks
app.get('/tasks/partial', (c) => {
  return c.html(renderTasksTableRows());
});

// Create a new task from form data, then return updated <tbody> snippet
app.post('/tasks', async (c) => {
  const { prompt, model } = await c.req.parseBody<{
    prompt?: string;
    model?: string;
  }>();

  if (!prompt || !model) {
    logger.error('[POST /tasks] Missing prompt or model');
    // Return the current state of tasks to re-render
    return c.html(renderTasksTableRows());
  }

  // Create and enqueue
  const record = createTaskRecord(model as any, prompt);
  await enqueueTask(record);

  // Return new tasks table
  return c.html(renderTasksTableRows());
});

// Download the task result as a .txt file
app.get('/tasks/:id/download', async (c) => {
  const id = c.req.param('id');
  const task = await getTask(id);

  if (!task) {
    return c.text('Task not found.', 404);
  }

  if (!task.result) {
    return c.text('No result yet for this task.', 400);
  }

  // Return as text file
  c.header('Content-Type', 'text/plain; charset=utf-8');
  c.header(
    'Content-Disposition',
    `attachment; filename="result-${task.id}.txt"`,
  );
  return c.body(task.result);
});

serve({ fetch: app.fetch, port: 3000 });
logger.info('Server started on http://localhost:3000');
