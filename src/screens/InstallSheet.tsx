import { installSheetOpen } from '../app/store';
import { BottomSheet } from '../components/BottomSheet';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { isStandalone } from '../services/platform';

/** Add to Home Screen instructions. Never claims an install happened. */
export function InstallSheet() {
  const close = () => (installSheetOpen.value = false);
  const standalone = isStandalone();
  return (
    <BottomSheet open={installSheetOpen.value} onClose={close} label="Add to Home Screen">
      <div class="install">
        <BrandMark size={64} />
        <h2 class="install-title">Add to Home Screen</h2>
        {standalone ? (
          <p class="install-lead">You’re already playing the Home Screen version. Everything works offline.</p>
        ) : (
          <>
            <p class="install-lead">Play full-screen, start instantly and keep every category available offline.</p>
            <ol class="install-steps">
                <li>
                  <span class="step-icon">
                    <Icon name="export" size={22} />
                  </span>
                  <span>
                    In Safari, tap <strong>Share</strong> in the toolbar.
                  </span>
                </li>
                <li>
                  <span class="step-icon">
                    <Icon name="plus-square" size={22} />
                  </span>
                  <span>
                    Scroll down and choose <strong>Add to Home Screen</strong>.
                  </span>
                </li>
                <li>
                  <span class="step-icon">
                    <Icon name="check" size={22} />
                  </span>
                  <span>
                    Tap <strong>Add</strong>. UPDOWNLY appears with your other apps.
                  </span>
                </li>
              </ol>
            <p class="install-note">
              On Android or desktop Chrome, use the browser menu and choose <strong>Install app</strong>.
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
