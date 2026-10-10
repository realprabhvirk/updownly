import { useEffect, useState } from 'preact/hooks';
import { formatValue } from '../data/format';
import type { MetricDefinition } from '../data/schema';
import { reducedMotion } from '../app/store';

/**
 * Brief count-up for revealed values (≈450 ms). Intermediate frames reuse
 * the final value's formatting scale so the unit never jumps; reduced
 * motion shows the final value immediately.
 */
export function CountUp({ value, metric, duration = 450 }: { value: number; metric: MetricDefinition; duration?: number }) {
  const final = formatValue(value, metric).value;
  const [text, setText] = useState(reducedMotion.value ? final : formatFrame(0, value, metric));
  useEffect(() => {
    if (reducedMotion.value) {
      setText(final);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setText(t >= 1 ? final : formatFrame(eased, value, metric));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span class="countup">{text}</span>;
}

function formatFrame(progress: number, value: number, metric: MetricDefinition): string {
  // Count within the final scale (e.g. 0 → 27.2 million) so units stay put.
  const finalText = formatValue(value, metric);
  const intermediate = formatValue(value * progress, metric);
  return intermediate.unit === finalText.unit ? intermediate.value : scaleLike(finalText.value, progress);
}

function scaleLike(finalValue: string, progress: number): string {
  const match = finalValue.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!match) return finalValue;
  const [, pre, num, post] = match;
  const decimals = num!.includes('.') ? num!.split('.')[1]!.length : 0;
  const v = Number(num!.replace(/,/g, '')) * progress;
  return `${pre}${v.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${post}`;
}
