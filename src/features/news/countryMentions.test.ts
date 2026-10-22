import { describe, expect, it } from 'vitest';
import { articleMentionsCountry } from './countryMentions';

describe('global country mention filters', () => {
  it('matches world country names and common editorial aliases', () => {
    expect(articleMentionsCountry('A new trade deal announced in the U.S. today', 'US')).toBe(true);
    expect(articleMentionsCountry('Flood relief reaches Congo-Kinshasa', 'CD')).toBe(true);
    expect(articleMentionsCountry('Talks resumed in Türkiye', 'TR')).toBe(true);
    expect(articleMentionsCountry('UN meeting held in the West Bank', 'PS')).toBe(true);
  });

  it('does not treat adjective-only country roots as verified coordinates', () => {
    expect(articleMentionsCountry('Iranian markets react to global news', 'IR')).toBe(false);
    expect(articleMentionsCountry('A local German election concluded', 'DE')).toBe(false);
  });

  it('returns no matches for unknown country codes', () => {
    expect(articleMentionsCountry('World news today', 'ZZ')).toBe(false);
  });
});
