import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MenaGlobe } from './MenaGlobe';
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
