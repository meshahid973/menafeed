import { geoBounds, geoCentroid, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson';
import rawCountryData from './data/world-countries.topojson?raw';
import rawContextCountryData from './data/world-countries-context.topojson?raw';
import rawLowContextCountryData from './data/world-countries-low.topojson?raw';
import rawCityData from './data/world-cities.topojson?raw';
import type { CountryCollection, CountryFeature } from './geography';

export interface CityFeatureProperties {
  id: string;
  name: string;
  countryName: string;
  countryCode: string;
  population: number;
  capital: boolean;
  labelLongitude: number;
  labelLatitude: number;
  aliases: readonly string[];
}

export type CityFeature = Feature<Polygon | MultiPolygon | Point, CityFeatureProperties>;
export type CityCollection = FeatureCollection<
  Polygon | MultiPolygon | Point,
  CityFeatureProperties
>;

export interface CountryEntry {
  feature: CountryFeature;
  code: string;
  name: string;
  center: [number, number];
  label: [number, number];
  boundingRadius: number;
}

function decodeCountries(raw: string): CountryFeature[] {
  const topology = JSON.parse(raw) as Topology<{
    countries: GeometryCollection;
  }>;
  const collection = feature(topology, topology.objects.countries) as CountryCollection;
  return collection.features;
}

function decodeCities(raw: string): CityFeature[] {
  const topology = JSON.parse(raw) as Topology<{
    cities: GeometryCollection;
  }>;
  const collection = feature(topology, topology.objects.cities) as CityCollection;
  return collection.features;
}

function toCountryEntry(country: CountryFeature): CountryEntry {
  const center = geoCentroid(country);
  const { labelLongitude, labelLatitude } = country.properties;
  const label: [number, number] =
    labelLongitude !== undefined &&
    labelLatitude !== undefined &&
    Number.isFinite(labelLongitude) &&
    Number.isFinite(labelLatitude)
      ? [labelLongitude, labelLatitude]
      : center;
  const [[west, south], [east, north]] = geoBounds(country);
  const crossesAntimeridian = east - west > 180;
  const boundingRadius = crossesAntimeridian
    ? Math.PI
    : Math.min(
        Math.PI,
        Math.max(
          geoDistance(center, [west, south]),
          geoDistance(center, [west, north]),
          geoDistance(center, [east, south]),
          geoDistance(center, [east, north]),
        ) + 0.08,
      );

  return {
    feature: country,
    code: country.properties.code,
    name: country.properties.name,
    center,
    label,
    boundingRadius,
  };
}

export const COUNTRY_FEATURES = decodeCountries(rawCountryData);
export const CONTEXT_COUNTRY_FEATURES = decodeCountries(rawContextCountryData);
export const LOW_CONTEXT_COUNTRY_FEATURES = decodeCountries(rawLowContextCountryData);
export const CITY_FEATURES = decodeCities(rawCityData);

export const COUNTRIES = COUNTRY_FEATURES.map(toCountryEntry);
export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));
function withDetailedMetadata(country: CountryFeature): CountryEntry {
  const detailed = COUNTRY_BY_CODE.get(country.properties.code);
  if (detailed) return { ...detailed, feature: country };
  return toCountryEntry(country);
}

export const CONTEXT_COUNTRIES = CONTEXT_COUNTRY_FEATURES.map(withDetailedMetadata);
export const LOW_CONTEXT_COUNTRIES = LOW_CONTEXT_COUNTRY_FEATURES.map(withDetailedMetadata);
export const CONTEXT_COUNTRY_BY_CODE = new Map(
  CONTEXT_COUNTRIES.map((country) => [country.code, country]),
);

export const CITY_BOUNDING_RADII = new WeakMap<CityFeature, number>();
for (const city of CITY_FEATURES) {
  if (city.geometry.type === 'Point') {
    CITY_BOUNDING_RADII.set(city, 0);
    continue;
  }
  const center: [number, number] = [city.properties.labelLongitude, city.properties.labelLatitude];
  const [[west, south], [east, north]] = geoBounds(city);
  const radius =
    east - west > 180
      ? Math.PI
      : Math.max(
          geoDistance(center, [west, south]),
          geoDistance(center, [west, north]),
          geoDistance(center, [east, south]),
          geoDistance(center, [east, north]),
        ) + 0.02;
  CITY_BOUNDING_RADII.set(city, Math.min(Math.PI, radius));
}

export const CITIES_BY_COUNTRY = new Map<string, CityFeature[]>();
for (const city of CITY_FEATURES) {
  const cities = CITIES_BY_COUNTRY.get(city.properties.countryCode) ?? [];
  cities.push(city);
  CITIES_BY_COUNTRY.set(city.properties.countryCode, cities);
}
for (const cities of CITIES_BY_COUNTRY.values()) {
  cities.sort(
    (a, b) =>
      Number(b.properties.capital) - Number(a.properties.capital) ||
      b.properties.population - a.properties.population,
  );
}

export function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

export const SELECTABLE_COUNTRIES = COUNTRIES.filter(({ code }) => isCountryCode(code)).sort(
  (a, b) => a.name.localeCompare(b.name),
);
