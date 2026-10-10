import { signal } from '@preact/signals';

/** Text for the polite live region (screen-reader announcements). */
export const announcement = signal('');
let n = 0;
export function announce(text: string): void {
  // Alternate a zero-width suffix so repeated identical messages re-announce.
  n++;
  announcement.value = text + (n % 2 ? '' : '​');
}
