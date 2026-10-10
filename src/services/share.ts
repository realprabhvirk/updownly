/** Native share sheet where available, clipboard otherwise. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareText(text: string, title = 'UPDOWNLY'): Promise<ShareOutcome> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text });
      return 'shared';
    }
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
    // Fall through to clipboard.
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
