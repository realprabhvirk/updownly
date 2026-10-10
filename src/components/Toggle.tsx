/** Accessible on/off switch styled like iOS. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      class="toggle"
      onClick={() => onChange(!checked)}
    >
      <span class="toggle-knob" aria-hidden="true" />
    </button>
  );
}
