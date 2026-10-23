import rawCountryData from './data/world-countries.geojson?raw';
import type { CountryCollection } from './geography';

const COUNTRY_FEATURES = (JSON.parse(rawCountryData) as CountryCollection).features;

export const WORLD_COUNTRIES = COUNTRY_FEATURES.filter((feature) =>
  /^[A-Z]{2}$/.test(feature.properties.code),
).map((feature) => ({
  code: feature.properties.code,
  name: feature.properties.name,
}));

const COUNTRY_NAMES = new Map(WORLD_COUNTRIES.map(({ code, name }) => [code, name]));

export function getWorldCountryName(code: string): string | undefined {
  return COUNTRY_NAMES.get(code);
}
