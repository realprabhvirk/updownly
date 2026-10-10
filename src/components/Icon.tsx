import type { JSX } from 'preact';
import { ICON_PATHS } from './icon-paths';

type Props = {
  name: string;
  size?: number;
  class?: string;
  /** Accessible label; omit for decorative icons. */
  label?: string;
} & Omit<JSX.SVGAttributes<SVGSVGElement>, 'size'>;

/** Locally bundled Phosphor icon (bold weight). */
export function Icon({ name, size = 24, class: className, label, ...rest }: Props) {
  const inner = ICON_PATHS[name];
  if (!inner) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      class={className ? `icon ${className}` : 'icon'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: inner }}
      {...rest}
    />
  );
}
