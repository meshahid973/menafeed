import type { FeedSourceState } from '../../features/news/contracts';
import './PublisherSelection.css';

interface Props {
  sources: FeedSourceState[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Compact multi-publisher roster; no selection means all sources. */
export function PublisherSelection({ sources, selected, onChange }: Props) {
  return (
    <fieldset className="signal-publishers">
      <legend>Publishers</legend>
      <button type="button" className="signal-publishers__all" onClick={() => onChange([])}>
        All publishers {selected.length === 0 ? '✓' : ''}
      </button>
      <div className="signal-publishers__list">
        {sources.map((source) => (
          <label className="signal-publishers__option" key={source.id}>
            <input
              type="checkbox"
              checked={selected.includes(source.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, source.id]
                    : selected.filter((id) => id !== source.id),
                )
              }
            />
            <span>{source.name}</span>
            <span className="signal-publishers__count">{source.count}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
