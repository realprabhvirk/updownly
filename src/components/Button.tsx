import type { ComponentChildren, JSX } from 'preact';
import { Icon } from './Icon';

type Variant = 'primary' | 'strong' | 'secondary' | 'ghost' | 'danger';

type Props = {
  variant?: Variant;
  size?: 'm' | 'l';
  icon?: string;
  iconRight?: string;
  block?: boolean;
  children?: ComponentChildren;
} & JSX.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = 'primary', size = 'm', icon, iconRight, block, children, class: cls, ...rest }: Props) {
  const classes = ['btn', `btn-${variant}`, `btn-${size}`, block ? 'btn-block' : '', typeof cls === 'string' ? cls : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" class={classes} {...rest}>
      {icon && <Icon name={icon} size={size === 'l' ? 22 : 18} />}
      {children && <span class="btn-label">{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'l' ? 22 : 18} />}
    </button>
  );
}
