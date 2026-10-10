import type { Fact, MetricDefinition } from '../data/schema';
import { formatValue, hiddenValue } from '../data/format';
import { Icon } from './Icon';
import { CountUp } from './CountUp';

type Props = {
  fact: Fact;
  metric: MetricDefinition;
  role: 'reference' | 'challenger';
  /** Challenger only: show the value (after the answer). */
  revealed?: boolean;
  /** Animate the number when it is revealed. */
  animate?: boolean;
  onInfo?: (fact: Fact) => void;
  colour?: string;
  footer?: preact.ComponentChildren;
  /** Challenger only, after answering: was the guess right? */
  outcome?: 'correct' | 'incorrect';
};

/**
 * One side of the comparison. The hidden value is never rendered into the
 * DOM — not even for assistive technology — until the player has answered.
 */
export function FactCard({ fact, metric, role, revealed = true, animate, onInfo, colour, footer, outcome }: Props) {
  const shown = role === 'reference' || revealed;
  // Never format the real value while it is hidden.
  const f = shown ? formatValue(fact.value, metric) : hiddenValue(metric);
  return (
    <section
      class={`fact fact-${role}${shown ? ' is-shown' : ''}`}
      style={colour ? { '--fact-bg': colour } : undefined}
      aria-label={role === 'reference' ? 'Current fact' : 'Next fact'}
    >
      {outcome && (
        <span class={`fact-badge is-${outcome}`} aria-hidden="true">
          <Icon name={outcome === 'correct' ? 'check' : 'x'} size={20} />
        </span>
      )}
      <div class="fact-head">
        <h2 class="fact-name">{fact.entityName}</h2>
        {fact.context && <p class="fact-context">{fact.context}</p>}
      </div>
      <p class="fact-value" aria-live="off">
        {shown ? (
          <>
            <span class="fact-number">{animate ? <CountUp value={fact.value} metric={metric} /> : f.value}</span>
            {f.unit && <span class="fact-unit"> {f.unit}</span>}
          </>
        ) : (
          <>
            <span class="fact-number fact-hidden" aria-label="Hidden value">
              {f.value}
            </span>
            {f.unit && <span class="fact-unit"> {f.unit}</span>}
          </>
        )}
      </p>
      <div class="fact-foot">
        {footer}
        {onInfo && shown && (
          <button type="button" class="fact-info icon-btn" onClick={() => onInfo(fact)} aria-label={`About this fact: ${fact.entityName}`}>
            <Icon name="info" size={20} />
          </button>
        )}
      </div>
    </section>
  );
}
