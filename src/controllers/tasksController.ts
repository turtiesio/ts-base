import { Context } from 'hono';
import { marked } from 'marked';
import {
  createTaskRecord,
  listAllTasks,
  getTaskById,
} from '../services/history/HistoryService.js';
import { JobQueue } from '../services/JobQueue.js';
import logger from '../utils/logger.js';
import { renderTasksPage, renderTasksTableBody } from '../views/tasksView.js';

// The shared job queue instance:
const jobQueue = new JobQueue();

// Example: register the ChatGPT/Claude providers on startup
import {
  ChatGPTProviderGPT4O,
  ChatGPTProviderO1,
  ChatGPTProviderO1Mini,
  ChatGPTProviderO1Pro,
} from '../services/providers/ChatGPTProvider.js';
import { ClaudeProvider } from '../services/providers/ClaudeProvider.js';

jobQueue.registerProvider(new ChatGPTProviderO1());
jobQueue.registerProvider(new ChatGPTProviderO1Pro());
jobQueue.registerProvider(new ChatGPTProviderO1Mini());
jobQueue.registerProvider(new ChatGPTProviderGPT4O());
jobQueue.registerProvider(new ClaudeProvider());

/**
 * Return full page with table & form
 */
export async function handleGetIndex(c: Context) {
  const tasks = await listAllTasks();
  // Build provider options for the model select
  const providerOptions = jobQueue
    .getProviders()
    .map((p) => `<option value="${p}">${p}</option>`)
    .join('');

  let htmlPage = renderTasksPage(tasks);
  // Insert the <option> list
  htmlPage = htmlPage.replace(
    "<!-- We'll fill the list of providers in the controller for now -->",
    providerOptions,
  );

  return c.html(htmlPage);
}

/**
 * Return just the <tbody> for tasks
 */
export async function handleGetTasksPartial(c: Context) {
  const tasks = await listAllTasks();
  return c.html(renderTasksTableBody(tasks));
}

/**
 * Create a new task
 */
export async function handlePostTask(c: Context) {
  const { prompt, model } = await c.req.parseBody<{
    prompt: string;
    model: string;
  }>();

  if (!prompt || !model) {
    logger.error('Missing prompt or model');
    return c.html('Missing prompt or model', 400);
  }

  const taskRecord = await createTaskRecord(model, prompt);
  jobQueue.enqueueTask(taskRecord);

  // Re-render the partial tasks table
  const tasks = await listAllTasks();
  return c.html(renderTasksTableBody(tasks));
}

/**
 * Show task output as Markdown (inline, rather than forcing download)
 /**
  * Handle markdown output with three modes:
  * 1. Download raw markdown (?download=1)
  * 2. Render markdown as HTML (?render=1)
  * 3. Fallback to pre/code for hx-swap usage
  *
  * Usage examples:
  * - Markdown preview: http://localhost:3000/tasks/{id}/markdown?render=1
  * - Markdown download: http://localhost:3000/tasks/{id}/markdown?download=1
  *   or click "Download (MD)" button in render view
  */
export async function handleGetTaskMarkdown(c: Context) {
  const id = c.req.param('id');
  const urlSearch = new URL(c.req.url).searchParams;
  const doRender = urlSearch.get('render') === '1';
  const doDownload = urlSearch.get('download') === '1';

  const task = await getTaskById(id);
  if (!task) {
    return c.text('Task not found.', 404);
  }
  if (!task.result) {
    return c.text('No result yet.', 400);
  }

  const markdownRaw = task.result;
  const markdownHtml = marked(markdownRaw);

  // 1) Download logic
  if (doDownload) {
    c.header('Content-Disposition', `attachment; filename="task-${id}.md"`);
    return c.body(markdownRaw);
  }

  // 2) Render logic
  if (doRender) {
    return c.html(`
       <html>
         <head>
           <title>Markdown Output - Task ${id}</title>
           <style>
             body { max-width: 800px; margin: 20px auto; padding: 0 20px; }
             a.download-link {
               display: inline-block;
               margin: 20px 0;
               padding: 10px 20px;
               background: #007bff;
               color: white;
               text-decoration: none;
               border-radius: 5px;
             }
           </style>
         </head>
         <body>
           <a href="?download=1" class="download-link" download>Download (MD)</a>
           ${markdownHtml}
         </body>
       </html>
     `);
  }

  // 3) Fallback for hx-swap usage
  const markdownContent = `<pre><code>${task.result}</code></pre>`;
  return c.html(markdownContent);
}
