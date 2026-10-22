import { getWorldCountryName } from '../map/worldCountries';

const COUNTRY_ALIASES: Record<string, readonly string[]> = {
  AE: ['UAE', 'United Arab Emirates'],
  BO: ['Bolivia', 'Plurinational State of Bolivia'],
  CD: ['DR Congo', 'DRC', 'Democratic Republic of the Congo', 'Congo-Kinshasa'],
  CG: ['Republic of the Congo', 'Congo-Brazzaville'],
  CI: ["Côte d'Ivoire", 'Ivory Coast'],
  CN: ['China', 'Chinese', 'PRC'],
  CZ: ['Czech Republic'],
  GB: ['UK', 'U.K.', 'United Kingdom', 'Britain', 'British', 'England', 'Scotland', 'Wales'],
  IR: ['Iran', 'Iranian'],
  KP: ['North Korea', 'DPRK'],
  KR: ['South Korea', 'South Korean', 'Republic of Korea'],
  LA: ['Laos', 'Lao PDR'],
  MM: ['Burma'],
  MK: ['North Macedonia'],
  PS: ['Palestine', 'Palestinian', 'West Bank', 'Gaza'],
  RU: ['Russian Federation'],
  SZ: ['Swaziland'],
  TL: ['East Timor'],
  TR: ['Turkey', 'Turkish'],
  TW: ['Taiwan'],
  US: ['USA', 'U.S.', 'United States', 'United States of America', 'American'],
  VA: ['Vatican City', 'Holy See'],
  VE: ['Venezuela'],
  VN: ['Vietnam'],
};

function normalizeWords(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * For feeds without publisher-supplied coordinates, country selection falls
 * back to headline/summary mentions. A mention is not treated as an event
 * coordinate and does not create a map marker.
 */
export function articleMentionsCountry(text: string, countryCode: string): boolean {
  const countryName = getWorldCountryName(countryCode);
  if (!countryName) return false;

  const normalized = ' ' + normalizeWords(text) + ' ';
  const candidates = [countryName, ...(COUNTRY_ALIASES[countryCode] ?? [])]
    .map(normalizeWords)
    .filter((value) => value.length >= 3);

  return candidates.some((candidate) => normalized.includes(' ' + candidate + ' '));
}
