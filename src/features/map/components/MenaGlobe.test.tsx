import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MenaGlobe } from './MenaGlobe';
import rawCountryData from '../data/mena-countries.geojson?raw';
import { getCountryFocus, MAP_HEIGHT, MAP_WIDTH, type CountryCollection } from '../geography';
import type { MenaCountryCode, MenaMarker } from '../types';

function ControlledMap() {
  const [selectedCountry, setSelectedCountry] = useState<MenaCountryCode | null>(null);
  return <MenaGlobe selectedCountry={selectedCountry} onCountrySelect={setSelectedCountry} />;
}

describe('MenaGlobe', () => {
  it('selects a country through its geographic shape and reports it to the parent', () => {
    const onCountrySelect = vi.fn();
    render(<MenaGlobe onCountrySelect={onCountrySelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select Bahrain' }));

    expect(onCountrySelect).toHaveBeenCalledWith('BH');
    const selection = screen.getByText('ACTIVE TERRITORY').parentElement;
    expect(selection).not.toBeNull();
    expect(within(selection!).getByText('Bahrain')).toBeInTheDocument();
  });

  it('supports keyboard country selection and a clear-selection action', () => {
    render(<ControlledMap />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Select Qatar' }), {
      key: 'Enter',
    });
    const selection = screen.getByText('ACTIVE TERRITORY').parentElement;
    expect(selection).not.toBeNull();
    expect(within(selection!).getByText('Qatar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear selection/ }));
    expect(within(selection!).getByText('No country selected')).toBeInTheDocument();
  });

  it.each([
    { name: 'Egypt', code: 'EG' },
    { name: 'Saudi Arabia', code: 'SA' },
    { name: 'Morocco', code: 'MA' },
  ])('centres and reorients the camera for $name using its boundary geometry', ({ name, code }) => {
    const previousMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true }),
    });

    try {
      render(<MenaGlobe />);
      fireEvent.click(screen.getByRole('button', { name: `Select ${name}` }));

      const transform = screen.getByTestId('map-layer').getAttribute('transform');
      expect(transform).not.toBeNull();
      const values = transform!.match(
        /^translate\(([-\d.eE]+) ([-\d.eE]+)\) scale\(([-\d.eE]+)\) rotate\(([-\d.eE]+)\)$/,
      );
      expect(values).not.toBeNull();

      const dataset = JSON.parse(rawCountryData) as CountryCollection;
      const feature = dataset.features.find((item) => item.properties.code === code);
      expect(feature).toBeDefined();
      const focus = getCountryFocus(feature!);
      expect(focus).not.toBeNull();

      const translateX = Number(values![1]);
      const translateY = Number(values![2]);
      const zoom = Number(values![3]);
      const rotation = (Number(values![4]) * Math.PI) / 180;
      const projectedX = translateX + zoom * (
        Math.cos(rotation) * focus!.x - Math.sin(rotation) * focus!.y
      );
      const projectedY = translateY + zoom * (
        Math.sin(rotation) * focus!.x + Math.cos(rotation) * focus!.y
      );

      expect(projectedX).toBeCloseTo(MAP_WIDTH / 2, 2);
      expect(projectedY).toBeCloseTo(MAP_HEIGHT / 2, 2);
      expect(zoom).toBeGreaterThan(1);
      expect(Math.abs(Number(values![4]))).toBeLessThanOrEqual(90);
    } finally {
      if (previousMatchMedia) {
        Object.defineProperty(window, 'matchMedia', previousMatchMedia);
      } else {
        delete (window as Partial<Window>).matchMedia;
      }
    }
  });

  it('renders coordinate-backed markers and reports marker selection', () => {
    const onMarkerSelect = vi.fn();
    const manama: MenaMarker = {
      id: 'manama-example',
      label: 'Example marker · Manama',
      longitude: 50.5876,
      latitude: 26.2235,
      detail: 'Demonstration coordinate only',
    };
    const invalid: MenaMarker = {
      id: 'invalid-example',
      label: 'Invalid marker',
      longitude: 300,
      latitude: 91,
    };

    render(<MenaGlobe markers={[manama, invalid]} onMarkerSelect={onMarkerSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Example marker · Manama/ }));

    expect(onMarkerSelect).toHaveBeenCalledWith(manama);
    expect(screen.queryByRole('button', { name: /Invalid marker/ })).not.toBeInTheDocument();
  });

  it('honors externally controlled selection rather than mutating it locally', () => {
    const onCountrySelect = vi.fn();
    render(<MenaGlobe selectedCountry="SA" onCountrySelect={onCountrySelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select Bahrain' }));

    expect(onCountrySelect).toHaveBeenCalledWith('BH');
    const selection = screen.getByText('ACTIVE TERRITORY').parentElement;
    expect(selection).not.toBeNull();
    expect(within(selection!).getByText('Saudi Arabia')).toBeInTheDocument();
  });
});
