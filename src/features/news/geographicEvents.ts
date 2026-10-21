import type { FeedArticle } from './contracts';

export interface GeoMarker {
  id: string;
  countryCode: string;
  cityName: string;
  longitude: number;
  latitude: number;
  articleIds: string[];
  count: number;
}

export interface GeoCoverage {
  countryCode: string;
  articleCount: number;
  cityCount: number;
}

export interface GeoSnapshot {
  markers: GeoMarker[];
  countries: GeoCoverage[];
}

/** Presentation-only selector. Map rendering and country selection remain independently owned. */
export function selectGeographicEvents(
  snapshot: GeoSnapshot,
  selectedCountry: string | null,
  articles: readonly FeedArticle[],
) {
  const markers = selectedCountry
    ? snapshot.markers.filter((marker) => marker.countryCode === selectedCountry)
    : snapshot.markers;
  const ids = new Set(markers.flatMap((marker) => marker.articleIds));
  const byId = new Map(articles.map((article) => [article.id, article]));
  const locatedStories = [...ids].map((id) => byId.get(id)).filter((item): item is FeedArticle => Boolean(item));
  return {
    markers,
    coverage: selectedCountry
      ? snapshot.countries.filter((entry) => entry.countryCode === selectedCountry)
      : snapshot.countries,
    locatedStories,
  };
}
