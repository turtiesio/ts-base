// src/runJourney.ts
import { PageWithCursor } from 'puppeteer-real-browser';
import logger from './utils/logger.js';
import clipboardy from 'clipboardy';
import { copyToClipboard } from './utils/clipboard.js';

interface InputTask {
  model: 'o1' | 'o1-mini' | 'o1-pro' | 'gpt-4o';
  prompt: string;
}

export async function promptChatGPT(page: PageWithCursor, task: InputTask) {
  logger.info('[runJourney] Starting prompt chatGPT');

  // If we haven’t already, we navigate:
  // (In the queue we do a page.goto('https://chatgpt.com'))
  // But if you prefer to do it here, that’s fine:
  // await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });

  logger.debug(`[runJourney] current URL: ${page.url()}`);

  // You’d do your login checks if needed...

  logger.info('[runJourney] Clicking model switcher dropdown button');
  await page.realCursor.click(
    "main [data-testid='model-switcher-dropdown-button'] > svg",
  );

  await page.waitForSelector("[data-testid='model-switcher-o1-pro']", {
    timeout: 3000,
  });
  await page.waitForSelector("[data-testid='model-switcher-o1']", {
    timeout: 3000,
  });

  logger.info(`[runJourney] Clicking model: ${task.model}`);
  if (task.model === 'o1-pro') {
    await page.realCursor.click("[data-testid='model-switcher-o1-pro'] > div");
  } else if (task.model === 'o1-mini') {
    await page.realCursor.click("[data-testid='model-switcher-o1-mini'] > div");
  } else if (task.model === 'o1') {
    await page.realCursor.click("[data-testid='model-switcher-o1'] > div");
  } else if (task.model === 'gpt-4o') {
    await page.realCursor.click("[data-testid='model-switcher-gpt-4o'] > div");
  }

  logger.info('[runJourney] Writing prompt to textarea');

  await page.realCursor.click('#prompt-textarea');

  logger.info('[runJourney] Copy and paste prompt');

  copyToClipboard(task.prompt);

  await page.keyboard.down('Shift');
  await page.keyboard.press('Insert');
  await page.keyboard.up('Shift');

  logger.info('[runJourney] Submitting prompt');

  await page.keyboard.press('Enter');

  logger.info('[runJourney] Prompt submitted, waiting for response...');

  // Wait for the "stop" button to go away as a naive approach
  // or any custom logic to detect completion
  while (true) {
    const stopButton = await page.$('[data-testid="stop-button"]');

    if (!stopButton) {
      break;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  await page.waitForSelector("[data-testid='copy-turn-action-button']");
  await page.realCursor.click("[data-testid='copy-turn-action-button']");

  const result = await clipboardy.read();
  logger.info(`[runJourney] Result: ${result}`);

  // Return the conversation text
  return result;
}
