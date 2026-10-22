import type { FeedArticle } from '../news/contracts';
import type { GeoSnapshot } from '../news/geographicEvents';

export interface HistoryBucket {
  startEpoch: number;
  count: number;
}

/** Publication time is distinct from the record's discovery time. */
export interface HistorySnapshot {
  startEpoch: number;
  endEpoch: number;
  bucketSeconds: number;
  selectedIndex: number;
  totalCount: number;
  selectedCount: number;
  buckets: HistoryBucket[];
  articles: FeedArticle[];
  geo: GeoSnapshot;
}
