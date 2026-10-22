import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

function preferReducedMotionForTest() {
  const previousMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: true }),
  });

  return () => {
    if (previousMatchMedia) {
      Object.defineProperty(window, 'matchMedia', previousMatchMedia);
    } else {
      delete (window as Partial<Window>).matchMedia;
    }
  };
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

  it('returns to the default map view when the selected country is clicked again', () => {
    const restoreMatchMedia = preferReducedMotionForTest();

    try {
      render(<MenaGlobe />);
      const egypt = screen.getByRole('button', { name: 'Select Egypt' });
      const layer = screen.getByTestId('map-layer');
      const selection = screen.getByText('ACTIVE TERRITORY').parentElement;

      fireEvent.click(egypt);
      expect(within(selection!).getByText('Egypt')).toBeInTheDocument();
      expect(layer).not.toHaveAttribute('transform', 'translate(0 0) scale(1)');

      fireEvent.click(egypt);
      expect(within(selection!).getByText('No country selected')).toBeInTheDocument();
      expect(layer).toHaveAttribute('transform', 'translate(0 0) scale(1)');
    } finally {
      restoreMatchMedia();
    }
  });

  it('also toggles the selected country off with keyboard activation', () => {
    const restoreMatchMedia = preferReducedMotionForTest();

    try {
      render(<ControlledMap />);
      const qatar = screen.getByRole('button', { name: 'Select Qatar' });
      const layer = screen.getByTestId('map-layer');
      const selection = screen.getByText('ACTIVE TERRITORY').parentElement;

      fireEvent.keyDown(qatar, { key: 'Enter' });
      expect(within(selection!).getByText('Qatar')).toBeInTheDocument();
      expect(layer).not.toHaveAttribute('transform', 'translate(0 0) scale(1)');

      fireEvent.keyDown(screen.getByRole('button', { name: 'Select Qatar' }), { key: 'Enter' });
      expect(within(selection!).getByText('No country selected')).toBeInTheDocument();
      expect(layer).toHaveAttribute('transform', 'translate(0 0) scale(1)');
    } finally {
      restoreMatchMedia();
    }
  });

  it('toggles a selected country off from the country list too', () => {
    const restoreMatchMedia = preferReducedMotionForTest();

    try {
      render(<ControlledMap />);
      const countryList = screen.getByLabelText('Choose a MENA country');
      const morocco = within(countryList).getByRole('button', { name: /Morocco/ });
      const layer = screen.getByTestId('map-layer');
      const selection = screen.getByText('ACTIVE TERRITORY').parentElement;

      fireEvent.click(morocco);
      expect(within(selection!).getByText('Morocco')).toBeInTheDocument();
      expect(layer).not.toHaveAttribute('transform', 'translate(0 0) scale(1)');

      fireEvent.click(within(countryList).getByRole('button', { name: /Morocco/ }));
      expect(within(selection!).getByText('No country selected')).toBeInTheDocument();
      expect(layer).toHaveAttribute('transform', 'translate(0 0) scale(1)');
    } finally {
      restoreMatchMedia();
    }
  });

  it.each([
    { name: 'Egypt', code: 'EG' },
    { name: 'Saudi Arabia', code: 'SA' },
    { name: 'Morocco', code: 'MA' },
  ])('gently zooms to and centres $name without rotating the map', ({ name, code }) => {
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
        /^translate\(([-\d.eE]+) ([-\d.eE]+)\) scale\(([-\d.eE]+)\)$/,
      );
      expect(values).not.toBeNull();
      expect(transform).not.toContain('rotate');

      const dataset = JSON.parse(rawCountryData) as CountryCollection;
      const feature = dataset.features.find((item) => item.properties.code === code);
      expect(feature).toBeDefined();
      const focus = getCountryFocus(feature!);
      expect(focus).not.toBeNull();

      const translateX = Number(values![1]);
      const translateY = Number(values![2]);
      const zoom = Number(values![3]);
      const projectedX = translateX + zoom * focus!.x;
      const projectedY = translateY + zoom * focus!.y;

      expect(projectedX).toBeCloseTo(MAP_WIDTH / 2, 2);
      expect(projectedY).toBeCloseTo(MAP_HEIGHT / 2, 2);
      expect(zoom).toBeGreaterThan(1);
      expect(zoom).toBeLessThanOrEqual(3.5);
    } finally {
      if (previousMatchMedia) {
        Object.defineProperty(window, 'matchMedia', previousMatchMedia);
      } else {
        delete (window as Partial<Window>).matchMedia;
      }
    }
  });

  it('keeps the camera position stable when hover rerenders during animation', () => {
    const animation = { frame: null as FrameRequestCallback | null };
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animation.frame = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    try {
      render(<MenaGlobe />);
      const egypt = screen.getByRole('button', { name: 'Select Egypt' });
      fireEvent.click(egypt);
      act(() => { animation.frame?.(0); });
      act(() => { animation.frame?.(200); });
      const layer = screen.getByTestId('map-layer');
      const duringMotion = layer.getAttribute('transform');
      expect(duringMotion).not.toBe('translate(0 0) scale(1)');
      fireEvent.mouseEnter(egypt);
      expect(layer).toHaveAttribute('transform', duringMotion);
    } finally {
      vi.unstubAllGlobals();
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
