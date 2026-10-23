import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MenaGlobe } from './MenaGlobe';
import type { MenaMarker } from '../types';

function ControlledMap() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  return <MenaGlobe selectedCountry={selectedCountry} onCountrySelect={setSelectedCountry} />;
}

function chooseCountry(code: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Select any country' }), {
    target: { value: code },
  });
}

describe('MenaGlobe', () => {
  it('selects a country and reports it to the parent', () => {
    const onCountrySelect = vi.fn();
    render(<MenaGlobe onCountrySelect={onCountrySelect} />);

    chooseCountry('BH');

    expect(onCountrySelect).toHaveBeenCalledWith('BH');
    const selection = screen.getByText('ACTIVE TERRITORY').parentElement;
    expect(selection).not.toBeNull();
    expect(within(selection!).getByText('Bahrain')).toBeInTheDocument();
  });

  it('supports MENA shortcut selection and a clear-selection action', () => {
    render(<ControlledMap />);

    fireEvent.click(screen.getByRole('button', { name: /Qatar/ }));
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

    chooseCountry('BH');

    expect(onCountrySelect).toHaveBeenCalledWith('BH');
    const selection = screen.getByText('ACTIVE TERRITORY').parentElement;
    expect(selection).not.toBeNull();
    expect(within(selection!).getByText('Saudi Arabia')).toBeInTheDocument();
  });

  it('does not render country names or cities on the default globe', () => {
    render(<MenaGlobe />);
    expect(screen.queryByTestId('country-label-layer')).not.toBeInTheDocument();
    expect(screen.getByTestId('globe-canvas')).toHaveAttribute('data-city-count', '0');
  });

  it('shows the selected country name and its city geometry only', () => {
    render(<MenaGlobe selectedCountry="IN" />);
    const label = screen.getByTestId('country-label-layer');
    expect(within(label).getByText('India')).toBeInTheDocument();
    expect(
      Number(screen.getByTestId('globe-canvas').getAttribute('data-city-count')),
    ).toBeGreaterThan(0);
    expect(
      Number(screen.getByTestId('globe-canvas').getAttribute('data-urban-area-count')),
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Tokyo')).not.toBeInTheDocument();
  });

  it('keeps only the newly selected country label when switching countries', () => {
    render(<ControlledMap />);
    chooseCountry('IN');
    expect(within(screen.getByTestId('country-label-layer')).getByText('India')).toBeVisible();

    chooseCountry('BH');
    const labels = screen.getAllByTestId('country-label-layer');
    expect(labels).toHaveLength(1);
    expect(within(labels[0]!).getByText('Bahrain')).toBeInTheDocument();
    expect(within(labels[0]!).queryByText('India')).not.toBeInTheDocument();
  });

  it('selects countries outside MENA', () => {
    const onCountrySelect = vi.fn();
    render(<MenaGlobe onCountrySelect={onCountrySelect} />);
    chooseCountry('IN');
    expect(onCountrySelect).toHaveBeenCalledWith('IN');
    const selection = screen.getByText('ACTIVE TERRITORY').parentElement;
    expect(selection).not.toBeNull();
    expect(within(selection!).getByText('India')).toBeInTheDocument();
  });
});
