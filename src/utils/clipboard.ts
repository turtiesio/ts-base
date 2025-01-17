import { execSync } from 'child_process';

export async function copyToClipboard(text: string) {
  execSync('pbcopy', { input: text });
}
