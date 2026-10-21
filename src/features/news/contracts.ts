/**
 * Core model shared by future news ingestion adapters and React features.
 * These are contracts, not proof that a provider's article claims are correct.
 * Validate untrusted input at the ingestion boundary before constructing them.
 */
export interface NewsSource {
  id: string;
  name: string;
  homepageUrl: string;
}

export interface Article {
  id: string;
  sourceId: NewsSource['id'];
  title: string;
  url: string;
  publishedAt: string; // UTC ISO-8601 instant
  summary?: string;
  language?: string; // BCP-47
  location: ArticleLocation;
}

export type ArticleLocation =
  | { precision: 'unknown' }
  | { precision: 'country'; countryCode: string }
  | {
      precision: 'city';
      countryCode: string; // ISO 3166-1 alpha-2
      cityName: string;
      latitude: number;
      longitude: number;
      /** The resolver's evidence; never infer verification from these coordinates alone. */
      evidence: 'publisher' | 'geocoded-mention' | 'manual-review';
    };
