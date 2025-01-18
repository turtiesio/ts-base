import { Task } from '../models/Task.js';
import { JobStatus } from '../models/JobStatus.js';

/**
 * Compute a human-readable elapsed time string in HH:MM:SS
 */
function formatElapsedTime(msDiff: number): string {
  if (msDiff <= 0) return '0s';

  const totalSeconds = Math.floor(msDiff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const remainingSeconds = totalSeconds % 3600;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');
}

/**
 * Return elapsed time text for a given task, if applicable.
 * - Pending => from createdAt to now
 * - InProgress => from startedAt to now
 * - Otherwise => blank (or '—')
 */
function getElapsedTimeString(task: Task): string {
  const now = Date.now();

  if (task.status === JobStatus.Pending) {
    return formatElapsedTime(now - task.createdAt);
  }

  if (task.status === JobStatus.InProgress && task.startedAt) {
    return formatElapsedTime(now - task.startedAt);
  }

  return '—';
}

/**
 * Render a table row for a single task
 */
function renderTaskRow(task: Task): string {
  // Show “View Output” button if we have a valid result URL
  const showResultButton =
    typeof task.result === 'string' && task.result.trim() !== ''
      ? `<a
         href="/tasks/${task.id}/markdown?render=1"
         target="_blank"
         class="result-link"
       >
         Show Output
       </a>`
      : '—';

  const showPromptLink = `
    <a href="/tasks/${task.id}/prompt" target="_blank" class="prompt-link">Show Input</a>
  `;

  return `
    <tr>
      <td>${task.title ?? '—'}</td>
      <td>${new Date(task.createdAt).toLocaleString()}</td>
      <td>${task.model}</td>
      <td>${task.status}</td>
      <td>${getElapsedTimeString(task)}</td>
      <td>${task.chatUrl ? `<a href="${task.chatUrl}" target="_blank">Open Chat</a>` : '—'}</td>
      <td>${showResultButton}</td>
      <td>${showPromptLink}</td>
    </tr>
  `;
}

/**
 * Render the full table body <tbody> for a list of tasks
 */
export function renderTasksTableBody(tasks: Task[]): string {
  return tasks.map((t) => renderTaskRow(t)).join('');
}

/**
 * Render the entire page for handleGetIndex
 */
const PAGE_TEMPLATE = `
  <html>
    <head>
      <title>Prompt ChatGPT/Claude</title>
      <script src="https://unpkg.com/htmx.org@1.9.2"></script>
      <style>
        /* Example "beautiful" style for radio group: */
        .radio-group label {
          display: inline-block;
          margin-right: 20px;
          padding: 5px 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          cursor: pointer;
        }
        .radio-group input[type="radio"] {
          margin-right: 5px;
        }
      </style>
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          // Restore last-selected model from localStorage
          const storedModel = localStorage.getItem('selectedModel');
          if (storedModel) {
            const radio = document.querySelector(\`input[name="model"][value="\${storedModel}"]\`);
            if (radio) {
              radio.checked = true;
            }
          }

          // Listen for radio changes
          const radios = document.querySelectorAll('input[name="model"]');
          radios.forEach(radio => {
            radio.addEventListener('change', () => {
              localStorage.setItem('selectedModel', radio.value);
            });
          });

          // Shortcut: Meta + Enter to submit the form
          const form = document.querySelector('form');
          const promptTextarea = document.querySelector('#prompt');
          promptTextarea.addEventListener('keydown', (e) => {
            if (e.metaKey && e.key === 'Enter') {
              e.preventDefault();
              form.submit();
            }
          });
        });
      </script>
    </head>
    <body>
      <h1>Parallel Job Queue Demo</h1>

      <form hx-post="/tasks" hx-target="#tasks-tbody" hx-swap="innerHTML">
        <label for="title">Title (optional):</label><br/>
        <input id="title" name="title" type="text" style="width: 400px;" /><br/><br/>
        <label for="prompt">Prompt:</label><br/>
        <textarea id="prompt" name="prompt" rows="15" cols="150"></textarea><br/><br/>
        <div style="display: inline-block;">
          <div class="radio-group" id="model-options" style="margin-bottom: 10px; display: inline-block;">
            <!-- We'll fill the list of providers in the controller for now -->
          </div>
          <button type="submit" style="margin-left: 10px; font-size: 1.2em;">Add Task</button>
        </div>
      </form>

      <!-- Auto refresh partial every 2s if you wish -->
      <div
        hx-get="/tasks/partial"
        hx-trigger="every 1s"
        hx-target="#tasks-tbody"
        hx-swap="innerHTML"
      ></div>

      <div>
        <h2 style="display: inline-block;">
          Tasks
        </h2>
        <button
          hx-get="/tasks/partial"
          hx-trigger="every 2s"
          hx-target="#tasks-tbody"
          hx-swap="innerHTML"
          style="font-size: 1.2em; margin-left: 10px;"
        >
          Refresh Tasks
        </button>
      </div>
      <table border="1" width="80%">
        <thead>
          <tr>
            <th>Title</th>
            <th>Created</th>
            <th>Model</th>
            <th>Status</th>
            <th>Elapsed</th>
            <th>Chat URL</th>
            <th>Result</th>
            <th>Prompt</th>
          </tr>
        </thead>
        <tbody id="tasks-tbody">
          {rows}
        </tbody>
      </table>

      <div id="modal-content"></div>
    </body>
  </html>
`;

export function renderTasksPage(tasks: Task[]): string {
  const rowsHtml = renderTasksTableBody(tasks);
  return PAGE_TEMPLATE.replace('{rows}', rowsHtml);
}
