/** The UPDOWNLY mark: two solid block arrows. Hand-drawn master in design/brand. */
export function BrandMark({ size = 32, class: className }: { size?: number; class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      class={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="1024" height="1024" rx="232" fill="#3155E8" />
      <path d="M352 200 L552 440 L432 440 L432 660 L272 660 L272 440 L152 440 Z" fill="#FFFFFF" />
      <path d="M672 824 L472 584 L592 584 L592 364 L752 364 L752 584 L872 584 Z" fill="#F2CF5B" />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span class="wordmark" style={{ '--wm-size': `${size}px` }}>
      <BrandMark size={size} />
      <span class="wordmark-text">UPDOWNLY</span>
    </span>
  );
}
