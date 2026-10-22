/**
 * Geographic precision is explicit; a location is never inferred merely
 * because a headline mentions a country or city.
 */
export interface NewsSource {
  id: string;
  name: string;
  homepageUrl: string;
}

export type ArticleLocation =
  | { precision: 'unknown' }
  | { precision: 'country'; countryCode: string }
  | {
      precision: 'city';
      countryCode: string;
      cityName: string;
      latitude: number;
      longitude: number;
      evidence: 'publisher' | 'geocoded-mention' | 'manual-review';
    };

export interface Article {
  /** Country relevance tags from publisher metadata and named places in story text; not geolocation. */
  countryCodes?: string[];
  id: string;
  sourceId: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary?: string;
  language?: string;
  location: ArticleLocation;
}

/** Rust owns publisher feeds, caching, and source attribution. */
export interface FeedArticle extends Article {
  sourceName: string;
  canonicalUrl?: string;
  category?: 'general' | 'politics' | 'economy' | 'humanitarian' | 'culture';
  clusterId?: string;
  clusterSize?: number;
}

export interface FeedSourceState {
  id: string;
  name: string;
  mode: 'fresh' | 'cached' | 'stale' | 'unavailable';
  count: number;
  checkedAt?: string;
}

export interface NewsFeedResponse {
  articles: FeedArticle[];
  sources: FeedSourceState[];
  receivedAt: string;
}
