import { geoConicConformal, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { CountryFeatureProperties, MenaMarker } from './types';

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 640;

export type CountryFeature = Feature<Geometry, CountryFeatureProperties>;
export type CountryCollection = FeatureCollection<Geometry, CountryFeatureProperties>;

export const MAP_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: MAP_WIDTH,
  maxY: MAP_HEIGHT,
} as const;

/** A fixed regional projection keeps markers in real geographic positions. */
export function createMenaProjection() {
  return geoConicConformal()
    .parallels([15, 42])
    .center([24, 27])
    .scale(560)
    .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2])
    .clipExtent([
      [MAP_BOUNDS.minX, MAP_BOUNDS.minY],
      [MAP_BOUNDS.maxX, MAP_BOUNDS.maxY],
    ]);
}

const MENA_PROJECTION = createMenaProjection();
const COUNTRY_PATH = geoPath(MENA_PROJECTION);

export function getCountryPath(feature: CountryFeature): string | null {
  return COUNTRY_PATH(feature);
}

export function projectCoordinate(
  longitude: number,
  latitude: number,
): [number, number] | null {
  if (!isValidGeoCoordinate(longitude, latitude)) return null;
  const point = MENA_PROJECTION([longitude, latitude]);
  if (!point || !point.every(Number.isFinite)) return null;
  return [point[0], point[1]];
}

export function isValidGeoCoordinate(
  longitude: number,
  latitude: number,
): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

export function markerPosition(marker: MenaMarker): [number, number] | null {
  return projectCoordinate(marker.longitude, marker.latitude);
}

export function isInsideMap(point: readonly [number, number]): boolean {
  const [x, y] = point;
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= MAP_BOUNDS.minX &&
    x <= MAP_BOUNDS.maxX &&
    y >= MAP_BOUNDS.minY &&
    y <= MAP_BOUNDS.maxY
  );
}
