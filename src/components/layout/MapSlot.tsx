import { MenaGlobe } from '../../features/map';
import type { MenaCountryCode, MenaMarker } from '../../features/map';
import './MapSlot.css';

interface Props {
  selectedCountry: MenaCountryCode | null;
  onCountrySelect: (country: MenaCountryCode | null) => void;
  markers?: readonly MenaMarker[];
  onMarkerSelect?: (marker: MenaMarker) => void;
}

/** Keeps the geographic feature independent from navigation and news. */
export function MapSlot({ selectedCountry, onCountrySelect, markers = [], onMarkerSelect }: Props) {
  return (
    <MenaGlobe
      className="signal-map--embedded"
      selectedCountry={selectedCountry}
      onCountrySelect={onCountrySelect}
      markers={markers}
      onMarkerSelect={onMarkerSelect}
    />
  );
}
