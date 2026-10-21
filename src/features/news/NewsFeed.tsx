import { useDeferredValue, useMemo, useState } from 'react';
import type { DesktopStatus } from '../../services/desktop';
import { openArticle } from '../../services/news';
import { StoryCard } from './StoryCard';
import { useNewsFeed } from './useNewsFeed';
import './NewsFeed.css';

interface Props {
  desktopStatus: DesktopStatus;
}

export function NewsFeed({ desktopStatus }: Props) {
  const enabled = desktopStatus.kind === 'ready';
  const { data, error, loading, refreshing, refresh } = useNewsFeed(enabled);
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [openError, setOpenError] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  const articles = useMemo(() => {
    return (data?.articles ?? []).filter((article) => {
      if (source !== 'all' && article.sourceId !== source) return false;
      if (!deferredQuery) return true;
      return `${article.title} ${article.summary ?? ''} ${article.sourceName}`
        .toLocaleLowerCase().includes(deferredQuery);
    });
  }, [data, source, deferredQuery]);

  const stale = data?.sources.some((s) => s.mode === 'stale');
  const available = data?.sources.filter((s) => s.mode !== 'unavailable').length ?? 0;

  async function handleOpen(url: string) {
    try {
      setOpenError(false);
      await openArticle(url);
    } catch {
      setOpenError(true);
    }
  }

  return (
    <section className="signal-feed" aria-labelledby="news-title">
      <div className="signal-feed__intro">
        <div className="signal-feed__eyebrow">
          <span>02 / EDITORIAL WIRE</span>
          <span className="signal-feed__dot" aria-hidden="true" />
        </div>
        <div className="signal-feed__heading">
          <div>
            <span className="signal-feed__section">FROM ACROSS THE REGION</span>
            <h2 id="news-title">The Briefing<span>.</span></h2>
          </div>
          <button
            className="signal-feed__refresh"
            type="button"
            disabled={!enabled || refreshing || loading}
            onClick={() => void refresh(true)}
            aria-label="Refresh news"
            title="Refresh news"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="signal-feed__description">Reporting from trusted publishers. Read beyond the headline.</p>
        <div className="signal-feed__metrics">
          <span><strong>{data?.articles.length ?? '—'}</strong> STORIES</span>
          <span><strong>{available || '—'}</strong> SOURCES</span>
          <span className="signal-feed__state">
            {loading ? 'CONNECTING' : desktopStatus.kind === 'preview' ? 'BROWSER PREVIEW' :
              desktopStatus.kind === 'checking' ? 'STARTING' : desktopStatus.kind === 'error' ?
              'DESKTOP OFFLINE' : stale ? 'CACHED NEWS' : available ? 'SOURCE SYNCED' : 'AWAITING SOURCES'}
          </span>
        </div>
      </div>

      <div className="signal-feed__controls">
        <label className="signal-feed__search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search headlines"
            aria-label="Search headlines"
          />
          <kbd>/</kbd>
        </label>
        <div className="signal-feed__sources" role="group" aria-label="Filter news sources">
          <button type="button" className={source === 'all' ? 'is-active' : ''} onClick={() => { setSource('all'); setSelected(null); }}>All sources</button>
          {data?.sources.map((item) => (
            <button
              key={item.id}
              type="button"
              className={source === item.id ? 'is-active' : ''}
              onClick={() => { setSource(item.id); setSelected(null); }}
            >{item.name}</button>
          ))}
        </div>
      </div>

      <div className="signal-feed__bar">
        <span>LATEST REPORTS</span>
        <span>{articles.length} RESULTS <span aria-hidden="true">↙</span></span>
      </div>

      <div className="signal-feed__scroll">
        {error && <div className="signal-feed__message" role="status">{error}</div>}
        {openError && <div className="signal-feed__message" role="alert">Could not open this article.</div>}
        {loading && <div className="signal-feed__message">Loading regional reporting…</div>}
        {!enabled && (
          <div className="signal-feed__empty">
            <span>WIRE / STANDBY</span>
            <p>{desktopStatus.kind === 'preview'
              ? 'Launch the Tauri desktop application to load publisher RSS feeds.'
              : desktopStatus.kind === 'error'
                ? 'The desktop service could not start.'
                : 'Connecting to the desktop service…'}</p>
          </div>
        )}
        {enabled && !loading && articles.length === 0 && (
          <div className="signal-feed__empty">
            <span>NO REPORTS FOUND</span>
            <p>{query || source !== 'all' ? 'Try another keyword or publisher.' : 'No articles are available from configured sources.'}</p>
          </div>
        )}
        {articles.map((article, index) => (
          <StoryCard
            key={article.id}
            article={article}
            index={index}
            expanded={selected === article.id}
            onToggle={() => setSelected(selected === article.id ? null : article.id)}
            onOpen={(url) => void handleOpen(url)}
          />
        ))}
        <p className="signal-feed__attribution">Headlines and short excerpts belong to their respective publishers. Source links open original reporting.</p>
      </div>
      <div className="signal-feed__foot">
        <span>{desktopStatus.kind === 'ready' ? 'RSS / LOCAL CACHE' : 'SIGNAL / PREVIEW'}</span>
        <span>NO GEOLOCATION CLAIMS</span>
      </div>
    </section>
  );
}
