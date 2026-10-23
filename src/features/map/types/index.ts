import type { MENA_COUNTRIES } from '../data/coverage';

export type MenaCountryCode = (typeof MENA_COUNTRIES)[number]['code'];

export interface CountryFeatureProperties {
  name: string;
  code: string;
  selectable: boolean;
  sourceResolution?: '10m' | '110m';
}

export interface MenaMarker {
  /** Stable caller-owned identifier. */
  id: string;
  label: string;
  longitude: number;
  latitude: number;
  /** Optional neutral metadata, not a news-story payload. */
  detail?: string;
}

export interface MenaGlobeProps {
  /** Omit for internal selection; pass null to control and clear selection. */
  selectedCountry?: string | null;
  /** Emits null when a selection is cleared. */
  onCountrySelect?: (country: string | null) => void;
  /** Markers are plotted from WGS84 longitude/latitude coordinates. */
  markers?: readonly MenaMarker[];
  onMarkerSelect?: (marker: MenaMarker) => void;
  className?: string;
  ariaLabel?: string;
}
