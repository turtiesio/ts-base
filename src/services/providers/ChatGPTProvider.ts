import { PageWithCursor } from 'puppeteer-real-browser';
import { Provider } from './Provider.js';
import logger from '../../utils/logger.js';
import clipboardy from 'clipboardy';
import { copyToClipboard } from '../../utils/clipboard.js';

class ChatGPTProvider implements Provider {
  public model = '';

  async runPrompt(page: PageWithCursor, prompt: string): Promise<string> {
    logger.info('[runJourney] Starting prompt chatGPT');

    function click(selector: string) {
      return page.click(selector);
      // return page.realCursor.click(selector, {
      //   moveDelay: 200,
      //   randomizeMoveDelay: true,
      // });
    }

    // Go to the ChatGPT website
    await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });

    // You’d do your login checks if needed...
    logger.info('[runJourney] Page loaded. Checking if user is logged in...');

    while (true) {
      if (
        !page.url().includes('auth/login') &&
        !page.url().includes('auth.openai.com') &&
        page.url().includes('chatgpt.com')
      ) {
        logger.info('[runJourney] User just logged in');
        break;
      }

      logger.debug('[runJourney] Waiting for user to login');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    }

    logger.info('[runJourney] User is logged in');

    logger.info('[runJourney] Switching model');

    await click("main [data-testid='model-switcher-dropdown-button'] > svg");

    await page.waitForSelector("[data-testid='model-switcher-o1-pro']", {
      timeout: 3000,
    });
    await page.waitForSelector("[data-testid='model-switcher-o1']", {
      timeout: 3000,
    });

    logger.info(`[runJourney] Clicking model: ${this.model}`);

    await click('[data-testid="model-switcher-o1-pro"] > div');

    logger.info('[runJourney] Writing prompt to textarea');

    await click('#prompt-textarea');

    logger.info('[runJourney] Copy and paste prompt');

    copyToClipboard(prompt);

    await page.keyboard.down('Shift');
    await page.keyboard.press('Insert');
    await page.keyboard.up('Shift');

    logger.info('[runJourney] Submitting prompt');

    await page.keyboard.press('Enter');

    logger.info('[runJourney] Prompt submitted, waiting for response...');

    // Wait for prompt to finish
    while (await page.$('[data-testid="stop-button"]')) {
      await new Promise((r) => setTimeout(r, 200));

      // TODO: Emit job progress
      // TODO: Handle job error
      // TODO: Handle job cancellation
      // TODO: Handle job timeout
    }

    await page.waitForSelector("[data-testid='copy-turn-action-button']");
    await click("[data-testid='copy-turn-action-button']");

    const result = await clipboardy.read();
    logger.info(`[runJourney] Result: ${result}`);

    // Return the conversation text
    return result;
  }
}

export class ChatGPTProviderO1 extends ChatGPTProvider {
  public model = 'o1';
}

export class ChatGPTProviderO1Pro extends ChatGPTProvider {
  public model = 'o1-pro';
}

export class ChatGPTProviderO1Mini extends ChatGPTProvider {
  public model = 'o1-mini';
}

export class ChatGPTProviderGPT4O extends ChatGPTProvider {
  public model = 'gpt-4o';
}
