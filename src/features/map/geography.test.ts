import { describe, expect, it } from 'vitest';
import rawCountryData from './data/world-countries.geojson?raw';
import { MENA_COUNTRIES } from './data/coverage';
import {
  getCountryPath,
  isInsideMap,
  isValidGeoCoordinate,
  markerPosition,
  projectCoordinate,
  type CountryCollection,
} from './geography';

const dataset = JSON.parse(rawCountryData) as CountryCollection;

describe('world coverage data', () => {
  it('includes global country-boundary features with unique feature codes', () => {
    const codes = dataset.features.map((feature) => feature.properties.code);

    expect(dataset.features.length).toBeGreaterThan(200);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('includes point markers for microstates omitted at world-map scale', () => {
    const byCode = new Map(dataset.features.map((feature) => [feature.properties.code, feature]));

    for (const [code, name] of [
      ['MC', 'Monaco'],
      ['VA', 'Vatican City'],
      ['LI', 'Liechtenstein'],
      ['AD', 'Andorra'],
      ['SM', 'San Marino'],
    ] as const) {
      const feature = byCode.get(code);
      expect(feature?.properties.name).toBe(name);
      expect(feature?.properties.sourceResolution).toBe('50m-point');
      expect(feature?.geometry.type).toBe('Point');
    }
  });

  it('keeps the full editorial MENA selection list with unique ISO alpha-2 codes', () => {
    const codes = MENA_COUNTRIES.map(({ code }) => code);

    expect(codes).toHaveLength(27);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('BH');
    expect(codes).toContain('PS');
    expect(codes).toContain('EH');
  });

  it('contains selectable country geometry for every entry in the MENA coverage manifest', () => {
    const available = new Set(
      dataset.features
        .filter((feature) => feature.properties.selectable)
        .map((feature) => feature.properties.code),
    );

    expect([...available].sort()).toEqual(MENA_COUNTRIES.map(({ code }) => code).sort());
  });

  it('retains higher-resolution Bahrain island geometry for the Gulf microstate', () => {
    const bahrain = dataset.features.find((feature) => feature.properties.code === 'BH');

    expect(bahrain).toBeDefined();
    expect(bahrain?.geometry.type).toBe('Polygon');
    expect(bahrain?.properties.sourceResolution).toBe('10m');
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
