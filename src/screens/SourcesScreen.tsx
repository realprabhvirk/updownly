import { navigate } from '../app/router';
import { Icon } from '../components/Icon';
import { CATALOG, DATA_MANIFEST } from '../data/catalog';

const n = (x: number) => x.toLocaleString('en-GB');

/** About the data: principal datasets, licences and attribution. */
export function SourcesScreen() {
  const m = DATA_MANIFEST;
  return (
    <div class="page sources">
      <button type="button" class="back" onClick={() => navigate('settings')}>
        <Icon name="caret-left" size={18} /> Settings
      </button>
      <h1 class="page-title">Data sources</h1>
      <p class="lead">
        Every number in UPDOWNLY is a real, source-backed observation. Nothing is generated or estimated by the app,
        and each collection compares only one measurement, unit and reference period.
      </p>
      <dl class="stat-grid stat-grid-3">
        <div>
          <dt>Facts</dt>
          <dd class="tabular">{n(m.totalFacts)}</dd>
        </div>
        <div>
          <dt>Categories</dt>
          <dd class="tabular">{CATALOG.length}</dd>
        </div>
        <div>
          <dt>Sources</dt>
          <dd class="tabular">{m.sources.length}</dd>
        </div>
      </dl>
      <ul class="source-list">
        {m.sources.map((src) => {
          const cols = CATALOG.filter((c) => c.sourceId === src.id);
          const count = cols.reduce((a, c) => a + c.count, 0);
          return (
            <li class="source card">
              <h2 class="source-name">{src.name}</h2>
              <p class="source-meta">
                {n(count)} facts · {cols.length} {cols.length === 1 ? 'category' : 'categories'} · {src.licence}
              </p>
              <p class="source-cols">{cols.map((c) => `${c.title} · ${c.subtitle}`).join(', ')}</p>
              <p class="source-attr">{src.attribution}</p>
              <p class="source-links">
                <a href={src.url} target="_blank" rel="noopener noreferrer">
                  Dataset <Icon name="arrow-square-out" size={14} />
                </a>
                <a href={src.licenceUrl} target="_blank" rel="noopener noreferrer">
                  Licence <Icon name="arrow-square-out" size={14} />
                </a>
                <span>Retrieved {src.retrievedAt}</span>
              </p>
            </li>
          );
        })}
      </ul>
      <p class="fine">
        Dataset version {m.dataVersion}, built {m.generatedAt}. Values with conflicting records, missing data or
        inconsistent definitions were excluded rather than guessed. The full coverage report ships with the source code
        (DATA-COVERAGE.md).
      </p>
    </div>
  );
}
