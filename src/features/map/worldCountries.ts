import { COUNTRY_FEATURES, isCountryCode } from './mapData';

export const WORLD_COUNTRIES = COUNTRY_FEATURES.filter((feature) =>
  isCountryCode(feature.properties.code),
).map((feature) => ({
  code: feature.properties.code,
  name: feature.properties.name,
}));

const COUNTRY_NAMES = new Map(WORLD_COUNTRIES.map(({ code, name }) => [code, name]));

export function getWorldCountryName(code: string): string | undefined {
  return COUNTRY_NAMES.get(code);
}
