import type { CollectionInfo } from '../data/catalog';
import { Icon } from './Icon';

const n = (x: number) => x.toLocaleString('en-GB');

/** A category entry point. `feature` tiles are large solid colour blocks. */
export function CategoryTile({
  info,
  feature,
  onOpen,
  best,
}: {
  info: CollectionInfo;
  feature?: boolean;
  onOpen: (id: string) => void;
  best?: number;
}) {
  return (
    <button
      type="button"
      class={feature ? 'tile tile-feature' : 'tile'}
      style={{ '--tile': info.group.colour }}
      onClick={() => onOpen(info.id)}
      aria-label={`${info.title}: ${info.subtitle}. ${n(info.count)} facts.${best ? ` Your best: ${best}.` : ''}`}
    >
      <span class="tile-icon" aria-hidden="true">
        <Icon name={info.icon} size={feature ? 28 : 22} />
      </span>
      <span class="tile-text">
        <span class="tile-title">{info.title}</span>
        <span class="tile-subtitle">{info.subtitle}</span>
        {feature && <span class="tile-desc">{info.descriptor}</span>}
      </span>
      <span class="tile-meta">
        <span class="tile-count">{n(info.count)} facts</span>
        {best ? (
          <span class="tile-best">
            <Icon name="trophy" size={12} /> {best}
          </span>
        ) : null}
      </span>
    </button>
  );
}
