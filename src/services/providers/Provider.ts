import { PageWithCursor } from 'puppeteer-real-browser';

export interface Provider {
  model: string;
  runPrompt(page: PageWithCursor, prompt: string): Promise<string>;
}
