import { connect, ConnectResult } from 'puppeteer-real-browser';
import logger from './logger.js';

let cachedBrowser: ConnectResult | null = null;

// Return an existing browser, or launch if none
async function getBrowserConnection(): Promise<ConnectResult> {
  if (cachedBrowser) {
    return cachedBrowser;
  }

  logger.debug('[puppeteer] Launching browser...');

  cachedBrowser = await connect({
    headless: false,
    turnstile: true,
    disableXvfb: true,
    ignoreAllFlags: false,
    customConfig: {
      userDataDir: `${process.cwd()}/.chrome`,
    },
  });
  logger.debug('[puppeteer] Browser launched');
  return cachedBrowser;
}

export async function getPage(): Promise<ConnectResult['page']> {
  const connection = await getBrowserConnection();
  const page = await connection.browser.newPage();
  return page as ConnectResult['page'];
}
