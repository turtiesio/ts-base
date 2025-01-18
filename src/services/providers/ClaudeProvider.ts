import { PageWithCursor } from 'puppeteer-real-browser';
import { Provider } from './Provider.js';

export class ClaudeProvider implements Provider {
  public model = 'claude-sonnet-3.5';

  async runPrompt(page: PageWithCursor, prompt: string): Promise<string> {
    // Similar approach to ChatGPTProvider, but with Claude's UI flows
    return 'Claude result...';
  }
}
