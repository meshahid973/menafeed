import { describe, expect, it } from 'vitest';
import { CITIES_BY_COUNTRY } from './mapData';
import { findHighlightedCityIds, normalizePlaceName } from './globeRenderer';
import type { MenaMarker } from './types';

const bahrainCities = CITIES_BY_COUNTRY.get('BH')!;
const manama = bahrainCities.find((city) => city.properties.aliases.includes('Manama'))!;

function marker(overrides: Partial<MenaMarker> = {}): MenaMarker {
  return {
    id: 'story-1',
    label: 'Example story',
    longitude: manama.properties.labelLongitude,
    latitude: manama.properties.labelLatitude,
    countryCode: 'BH',
    cityName: 'Manama',
    ...overrides,
  };
}

describe('urban news context', () => {
  it('bundles Manama as a real urban polygon rather than only a point', () => {
    expect(manama).toBeDefined();
    expect(manama.geometry.type).not.toBe('Point');
  });

  it('highlights a city area using article city metadata', () => {
    expect(findHighlightedCityIds(bahrainCities, [marker()], 'BH')).toContain(manama.properties.id);
  });

  it('can match a story coordinate to an urban footprint without a city name', () => {
    expect(
      findHighlightedCityIds(bahrainCities, [marker({ cityName: undefined })], 'BH'),
    ).toContain(manama.properties.id);
  });

  it('does not highlight a different country or normalize diacritics incorrectly', () => {
    expect(findHighlightedCityIds(bahrainCities, [marker({ countryCode: 'QA' })], 'BH').size).toBe(
      0,
    );
    expect(normalizePlaceName('São Paulo')).toBe('sao paulo');
  });
});
