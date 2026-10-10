import type { Direction } from '../game/types';
import { Icon } from './Icon';

/**
 * The two primary controls, stacked so "higher" sits above "lower".
 * Large targets for one-handed use; keyboard: ↑/H and ↓/L.
 */
export function AnswerButtons({
  onAnswer,
  disabled,
  higherWord,
  lowerWord,
}: {
  onAnswer: (d: Direction) => void;
  disabled?: boolean;
  higherWord: string;
  lowerWord: string;
}) {
  return (
    <div class="answers" role="group" aria-label="Your answer">
      <button
        type="button"
        class="answer answer-higher"
        disabled={disabled}
        onClick={() => onAnswer('higher')}
        aria-keyshortcuts="ArrowUp H"
        data-testid="answer-higher"
      >
        <span class="answer-arrow" aria-hidden="true">
          <Icon name="arrow-fat-up-fill" size={26} />
        </span>
        <span class="answer-label">Higher</span>
        {higherWord.toLowerCase() !== 'higher' && (
          <span class="answer-hint" aria-hidden="true">
            {higherWord}
          </span>
        )}
      </button>
      <button
        type="button"
        class="answer answer-lower"
        disabled={disabled}
        onClick={() => onAnswer('lower')}
        aria-keyshortcuts="ArrowDown L"
        data-testid="answer-lower"
      >
        <span class="answer-arrow" aria-hidden="true">
          <Icon name="arrow-fat-down-fill" size={26} />
        </span>
        <span class="answer-label">Lower</span>
        {lowerWord.toLowerCase() !== 'lower' && (
          <span class="answer-hint" aria-hidden="true">
            {lowerWord}
          </span>
        )}
      </button>
    </div>
  );
}
