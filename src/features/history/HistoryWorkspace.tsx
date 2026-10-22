import { useEffect, useMemo, useState } from 'react';
import { Clock3, MapPin, RefreshCcw } from 'lucide-react';
import type { MenaCountryCode, MenaMarker } from '../map';
import { getMenaCountryName } from '../map';
import type { DesktopStatus } from '../../services/desktop';
import { getReportingHistory, openArticle } from '../../services/news';
import type { FeedArticle } from '../news/contracts';
import { ArticleReader } from '../news/ArticleReader';
import { MapSlot } from '../../components/layout/MapSlot';
import { WorkspaceSplit } from '../../components/layout/WorkspaceSplit';
import type { HistorySnapshot } from './contracts';
import './HistoryWorkspace.css';

const DAY = 86400;
const HOUR = 3600;
type Period = 'day' | 'week';

function utc(epoch: number, time = true): string {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(new Date(epoch * 1000));
}

function Sparkline({ data, index }: { data: HistorySnapshot | null; index: number }) {
  const counts = data?.buckets.map((bucket) => bucket.count) ?? [];
  const maximum = Math.max(1, ...counts);
  const y = (count: number) => 60 - (count / maximum) * 53;
  const x = (position: number) => (position / Math.max(1, counts.length - 1)) * 600;
  return (
    <svg viewBox="0 0 600 64" preserveAspectRatio="none" className="signal-history__spark"
      role="img" aria-label="Indexed reporting activity by time interval">
      <path d="M0 60 H600" stroke="currentColor" opacity="0.2" />
      {counts.length > 0 && (
        <>
          <polyline fill="none" stroke="var(--signal-accent)" strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            points={counts.map((count, slot) => `${x(slot)},${y(count)}`).join(' ')} />
          <circle cx={x(index)} cy={y(counts[index] ?? 0)} r="3.5"
            fill="var(--signal-accent)" />
        </>
      )}
    </svg>
  );
}

interface Props {
  desktopStatus: DesktopStatus;
  country: MenaCountryCode | null;
  onCountrySelect: (country: MenaCountryCode | null) => void;
  bookmarks: FeedArticle[];
  onToggleBookmark: (article: FeedArticle) => void;
}

export function HistoryWorkspace({
  desktopStatus, country, onCountrySelect, bookmarks, onToggleBookmark,
}: Props) {
  const [period, setPeriod] = useState<Period>('day');
  const [slot, setSlot] = useState(23);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; data: HistorySnapshot } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [reading, setReading] = useState<FeedArticle | null>(null);
  const [openError, setOpenError] = useState(false);

  const count: 24 | 28 = period === 'day' ? 24 : 28;
  const step = period === 'day' ? HOUR : HOUR * 6;
  const end = useMemo(() => Math.floor(Date.now() / 1000 / step) * step, [step, revision]);
  const start = end - (period === 'day' ? DAY : 7 * DAY);
  const index = Math.min(slot, count - 1);
  const key = `${start}:${end}:${index}:${country ?? ''}:${revision}`;
  const data = loaded?.key === key ? loaded.data : null;
  const error = failed?.key === key ? failed.message : null;
  const loading = desktopStatus.kind === 'ready' && !data && !error;

  useEffect(() => {
    if (desktopStatus.kind !== 'ready') return;
    let active = true;
    const timer = window.setTimeout(() => {
      void getReportingHistory(start, end, count, index, country)
        .then((response) => {
          if (!active) return;
          setLoaded({ key, data: response });
          setFailed(null);
        })
        .catch(() => {
          if (active) setFailed({ key, message: 'Could not read indexed reporting.' });
        });
    }, 90);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [desktopStatus.kind, start, end, count, index, country, key]);

  const markers = useMemo<MenaMarker[]>(() => (data?.geo.markers ?? []).flatMap((marker) => {
    const story = data?.articles.find((article) => marker.articleIds.includes(article.id));
    return story ? [{
      id: story.id, label: `${marker.cityName} · ${marker.count} reports`,
      longitude: marker.longitude, latitude: marker.latitude,
      detail: 'Publisher-verified location',
    }] : [];
  }), [data]);

  const groups = useMemo(() => {
    const byDate = new Map<string, FeedArticle[]>();
    for (const article of data?.articles ?? []) {
      if (!article.publishedAt) continue;
      const date = utc(Date.parse(article.publishedAt) / 1000, false);
      byDate.set(date, [...(byDate.get(date) ?? []), article]);
    }
    return [...byDate].map(([date, articles]) => ({ date, articles }));
  }, [data]);

  function choosePeriod(next: Period) {
    setPeriod(next);
    setSlot(next === 'day' ? 23 : 27);
    setReading(null);
  }
  async function original(url: string) {
    try {
      setOpenError(false);
      await openArticle(url);
    } catch {
      setOpenError(true);
    }
  }

  const slotStart = start + index * step;
  return (
    <section className="signal-history" aria-label="Historical reporting">
      <div className="signal-history__controls">
        <div className="signal-history__heading">
          <div>
            <span className="signal-history__eyebrow"><Clock3 size={13} /> REPORTING ARCHIVE</span>
            <h2>{country ? getMenaCountryName(country) : 'Across the region'}</h2>
          </div>
          <div className="signal-history__actions">
            {country && <button type="button" onClick={() => onCountrySelect(null)}>All countries</button>}
            <button type="button" aria-label="Refresh history"
              onClick={() => setRevision((current) => current + 1)}>
              <RefreshCcw size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="signal-history__period" aria-label="Reporting range">
          <button type="button" aria-pressed={period === 'day'} onClick={() => choosePeriod('day')}>24 hours</button>
          <button type="button" aria-pressed={period === 'week'} onClick={() => choosePeriod('week')}>7 days</button>
          <span>{data ? `${data.totalCount} indexed reports` : 'Local SQLite history'}</span>
        </div>
        <Sparkline data={data} index={index} />
        <label className="signal-history__time" htmlFor="signal-history-scrubber">
          <span>TIME SCRUBBER</span>
          <strong>{utc(slotStart)}–{utc(slotStart + step)} UTC</strong>
        </label>
        <input id="signal-history-scrubber" type="range" min={0} max={count - 1}
          step={1} value={index} className="signal-history__scrubber"
          aria-label="Reporting time" aria-valuetext={`${utc(slotStart)} UTC`}
          onChange={(event) => { setSlot(Number(event.target.value)); setReading(null); }} />
        <div className="signal-history__scale" aria-hidden="true">
          <span>{utc(start, false)}</span><span>{utc(end, false)} UTC</span>
        </div>
      </div>
      {desktopStatus.kind !== 'ready' ? (
        <p className="signal-history__message">The reporting archive is available in the desktop app.</p>
      ) : (
        <div className="signal-history__workspace">
          <WorkspaceSplit
            map={
              <div className="signal-history__map">
                <MapSlot selectedCountry={country}
                  onCountrySelect={(next) => { setReading(null); onCountrySelect(next); }}
                  markers={markers}
                  onMarkerSelect={(marker) => {
                    const article = data?.articles.find((item) => item.id === marker.id);
                    if (article) setReading(article);
                  }} />
                {!markers.length && (
                  <div className="signal-history__map-note">
                    <MapPin size={13} /> No verified city events in this interval
                  </div>
                )}
              </div>
            }
            feed={
              <div className="signal-history__feed">
                {reading ? (
                  <>
                    {openError && <p role="alert" className="signal-history__message">Could not open the original report.</p>}
                    <ArticleReader key={reading.id} article={reading}
                      saved={bookmarks.some((article) => article.url === reading.url)}
                      onToggleSave={() => onToggleBookmark(reading)}
                      onBack={() => { setReading(null); setOpenError(false); }}
                      onOpen={(url) => void original(url)} />
                  </>
                ) : (
                  <>
                    <div className="signal-history__feed-header">
                      {loading ? 'Reading index…' : `${data?.selectedCount ?? 0} reports in this interval`}
                      {data && data.selectedCount > data.articles.length && (
                        <small>Latest {data.articles.length} shown</small>
                      )}
                    </div>
                    <div className="signal-history__reports" aria-live="polite">
                      {loading && <p role="status" className="signal-history__message">Loading reports…</p>}
                      {error && <p role="alert" className="signal-history__message">{error}</p>}
                      {data && !data.articles.length &&
                        <p className="signal-history__message">No stored reports published in this interval.</p>}
                      {groups.map((group) => (
                        <div key={group.date}>
                          <h3 className="signal-history__date">{group.date} · UTC</h3>
                          {group.articles.map((article) => (
                            <button key={article.canonicalUrl ?? article.url} type="button"
                              className="signal-history__report" onClick={() => setReading(article)}>
                              <span>{article.sourceName} · {utc(Date.parse(article.publishedAt ?? '') / 1000)} UTC</span>
                              <strong>{article.title}</strong>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            }
          />
        </div>
      )}
    </section>
  );
}
