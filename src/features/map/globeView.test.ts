import { describe, expect, it } from 'vitest';
import { COUNTRY_BY_CODE } from './mapData';
import { createGlobeProjection, findCountryAtPoint, getCountryView } from './globeView';

describe('globe country navigation', () => {
  it('zooms small countries closer than large countries', () => {
    const bahrain = COUNTRY_BY_CODE.get('BH')!;
    const saudiArabia = COUNTRY_BY_CODE.get('SA')!;

    const bahrainView = getCountryView(bahrain);
    const saudiView = getCountryView(saudiArabia);

    expect(bahrainView.zoom).toBeGreaterThan(saudiView.zoom);
    expect(bahrainView.zoom).toBeGreaterThan(1);
    expect(saudiView.zoom).toBeGreaterThan(1);
    expect(bahrainView.longitude).toBeCloseTo(bahrain.label[0]);
    expect(bahrainView.latitude).toBeCloseTo(bahrain.label[1]);
  });

  it('hit-tests canvas points against detailed country geometry', () => {
    const bahrain = COUNTRY_BY_CODE.get('BH')!;
    const view = getCountryView(bahrain);
    const point = createGlobeProjection(view)(bahrain.label)!;

    expect(findCountryAtPoint(point, view)?.code).toBe('BH');
  });
});
