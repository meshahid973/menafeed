export const MENA_COUNTRIES = [
  { code: 'DZ', name: 'Algeria' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IL', name: 'Israel' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LY', name: 'Libya' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MA', name: 'Morocco' },
  { code: 'OM', name: 'Oman' },
  { code: 'PS', name: 'Palestine' },
  { code: 'QA', name: 'Qatar' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SO', name: 'Somalia' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SY', name: 'Syria' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'YE', name: 'Yemen' },
  { code: 'EH', name: 'Western Sahara' },
  { code: 'CY', name: 'Cyprus' },
] as const;

export const MENA_COUNTRY_CODES = new Set<string>(
  MENA_COUNTRIES.map(({ code }) => code),
);

export function getMenaCountryName(code: string): string | undefined {
  return MENA_COUNTRIES.find((country) => country.code === code)?.name;
}
