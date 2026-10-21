import { describe, expect, it } from 'vitest';
import rawCountryData from './data/mena-countries.geojson?raw';
import { MENA_COUNTRIES } from './data/coverage';
import {
  getCountryFocus,
  getCountryPath,
  isInsideMap,
  isValidGeoCoordinate,
  markerPosition,
  projectCoordinate,
  type CountryCollection,
  type CountryFeature,
} from './geography';

const dataset = JSON.parse(rawCountryData) as CountryCollection;

describe('MENA coverage data', () => {
  it('provides the full editorial selection list with unique ISO alpha-2 codes', () => {
    const codes = MENA_COUNTRIES.map(({ code }) => code);

    expect(codes).toHaveLength(27);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('BH');
    expect(codes).toContain('PS');
    expect(codes).toContain('EH');
  });

  it('contains selectable country geometry for every entry in the coverage manifest', () => {
    const available = new Set(
      dataset.features
        .filter((feature) => feature.properties.selectable)
        .map((feature) => feature.properties.code),
    );

    expect([...available].sort()).toEqual(MENA_COUNTRIES.map(({ code }) => code).sort());
  });

  it('retains Bahrain island geometry for the Gulf microstate', () => {
    const bahrain = dataset.features.find((feature) => feature.properties.code === 'BH');

    expect(bahrain).toBeDefined();
    expect(bahrain?.geometry.type).toBe('Polygon');
    expect(getCountryPath(bahrain!)).toContain('M');
  });
});

describe('geographic coordinates', () => {
  it('accepts only finite WGS84 longitude and latitude ranges', () => {
    expect(isValidGeoCoordinate(50.5876, 26.2235)).toBe(true);
    expect(isValidGeoCoordinate(181, 26)).toBe(false);
    expect(isValidGeoCoordinate(50, -91)).toBe(false);
    expect(isValidGeoCoordinate(Number.NaN, 0)).toBe(false);
    expect(isValidGeoCoordinate(0, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('projects the example Manama coordinate inside the MENA viewport', () => {
    const point = projectCoordinate(50.5876, 26.2235);

    expect(point).not.toBeNull();
    expect(isInsideMap(point!)).toBe(true);
  });

  it.each([
    ['Egypt', 'EG'],
    ['Saudi Arabia', 'SA'],
    ['Morocco', 'MA'],
  ])('computes a finite zoom-and-centre target for %s without rotation data', (_, code) => {
    const feature = dataset.features.find((item) => item.properties.code === code);

    expect(feature).toBeDefined();
    const focus = getCountryFocus(feature as CountryFeature);
    expect(focus).not.toBeNull();
    expect(focus!.width).toBeGreaterThan(0);
    expect(focus!.height).toBeGreaterThan(0);
  });

  it('does not project invalid marker coordinates', () => {
    expect(
      markerPosition({
        id: 'outside-range',
        label: 'Invalid coordinate',
        longitude: 250,
        latitude: 26,
      }),
    ).toBeNull();
  });
});
