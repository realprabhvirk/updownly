import { useRef } from 'preact/hooks';

type Option<T extends string> = { value: T; label: string };

/** iOS-style segmented control with radio semantics and arrow-key support. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<Option<T>>;
  onChange: (v: T) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const index = options.findIndex((o) => o.value === value);
  const onKey = (e: KeyboardEvent) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = options[(index + delta + options.length) % options.length]!;
    onChange(next.value);
    requestAnimationFrame(() => (ref.current?.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus());
  };
  return (
    <div
      class="segmented"
      role="radiogroup"
      aria-label={label}
      ref={ref}
      onKeyDown={onKey}
      style={{ '--seg-count': options.length, '--seg-index': Math.max(0, index) }}
    >
      <span class="segmented-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          class="segmented-option"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
