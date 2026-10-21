import { describe, expect, it } from 'vitest';
import { selectGeographicEvents, type GeoSnapshot } from './geographicEvents';

const snapshot: GeoSnapshot = {
  markers: [
    { id: 'bh', countryCode: 'BH', cityName: 'Manama', latitude: 26.2, longitude: 50.5, count: 1, articleIds: ['a'] },
    { id: 'eg', countryCode: 'EG', cityName: 'Cairo', latitude: 30.0, longitude: 31.2, count: 1, articleIds: ['b'] },
  ],
  countries: [
    { countryCode: 'BH', articleCount: 2, cityCount: 1 },
    { countryCode: 'EG', articleCount: 1, cityCount: 1 },
  ],
};
const articles = ['a', 'b'].map((id) => ({
  id, title: id, url: `https://example.org/${id}`, sourceId: 'pub', sourceName: 'Publisher',
  publishedAt: null, location: { precision: 'unknown' as const },
}));

describe('geographic evidence adapter', () => {
  it('returns only matching markers and corresponding reports', () => {
    const selected = selectGeographicEvents(snapshot, 'BH', articles);
    expect(selected.markers.map((m) => m.id)).toEqual(['bh']);
    expect(selected.locatedStories.map((a) => a.id)).toEqual(['a']);
    expect(selected.coverage).toHaveLength(1);
  });
  it('keeps regional overview when no country is selected', () => {
    expect(selectGeographicEvents(snapshot, null, articles).markers).toHaveLength(2);
  });
});
