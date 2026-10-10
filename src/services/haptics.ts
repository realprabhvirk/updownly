/**
 * Haptic feedback, only where the platform genuinely supports it:
 *  - the Vibration API (Android Chrome and others);
 *  - iOS 18+ Safari, which plays the system haptic when a native switch
 *    control toggles. We toggle a hidden switch inside the tap handler.
 * Elsewhere this is a silent no-op, and the app never claims a vibration
 * happened.
 */
import { isIOS } from './platform';

type Kind = 'light' | 'success' | 'error';

let iosLabel: HTMLLabelElement | null = null;

function supportsSwitchHaptic(): boolean {
  if (typeof document === 'undefined' || !isIOS()) return false;
  const input = document.createElement('input');
  return 'switch' in input;
}

export function hapticsSupported(): boolean {
  try {
    return (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') || supportsSwitchHaptic();
  } catch {
    return false;
  }
}

function iosTick(): void {
  if (!iosLabel) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-10px;top:-10px';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosLabel = label;
  }
  iosLabel.click();
}

/** Must be called synchronously from a user gesture to work on iOS. */
export function haptic(kind: Kind): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'error' ? [30, 40, 30] : kind === 'success' ? 18 : 10);
      return;
    }
    if (supportsSwitchHaptic()) {
      iosTick();
      if (kind === 'error') setTimeout(iosTick, 90);
    }
  } catch {
    // Feedback is best-effort.
  }
}
