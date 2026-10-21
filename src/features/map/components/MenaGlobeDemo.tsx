import { useState } from 'react';
import { MenaGlobe } from './MenaGlobe';
import type { MenaCountryCode, MenaMarker } from '../types';

const EXAMPLE_MARKERS: readonly MenaMarker[] = [
  {
    id: 'demo-manama',
    label: 'Manama · example coordinate',
    longitude: 50.5876,
    latitude: 26.2235,
    detail: 'Geographic demonstration only; not a news event',
  },
];

export function MenaGlobeDemo() {
  const [selectedCountry, setSelectedCountry] = useState<MenaCountryCode | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MenaMarker | null>(null);

  return (
    <main className="signal-map-demo">
      <header className="signal-map-demo__intro">
        <p className="signal-map-demo__eyebrow">SIGNAL / MENA · FEATURE PREVIEW</p>
        <h1 className="signal-map-demo__title">The region, in context.</h1>
        <p className="signal-map-demo__description">
          A geographic foundation for future location-aware reporting. Select a country,
          pan the region, or zoom to inspect the boundaries.
        </p>
        <p className="signal-map-demo__notice">
          <strong>DEMO DATA ONLY</strong> · The Manama marker uses example geographic coordinates.
          It is not connected to news ingestion and does not represent a reported event.
        </p>
      </header>
      <MenaGlobe
        selectedCountry={selectedCountry}
        onCountrySelect={setSelectedCountry}
        markers={EXAMPLE_MARKERS}
        onMarkerSelect={setSelectedMarker}
      />
      {selectedMarker && (
        <p className="signal-map-demo__notice" role="status">
          Selected location: {selectedMarker.label} — {selectedMarker.latitude.toFixed(4)}° N,{' '}
          {selectedMarker.longitude.toFixed(4)}° E. This is an example coordinate, not a news event.
        </p>
      )}
    </main>
  );
}
