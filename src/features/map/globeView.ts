import { geoContains, geoDistance, geoOrthographic, geoPath } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import { COUNTRIES, type CountryEntry } from './mapData';
import { MAP_HEIGHT, MAP_WIDTH } from './geography';

export interface GlobeView {
  longitude: number;
  latitude: number;
  zoom: number;
}

export const INITIAL_VIEW: GlobeView = { longitude: 24, latitude: 27, zoom: 1 };
export const MIN_ZOOM = 0.65;
export const MAX_ZOOM = 20;
export const GLOBE_RADIUS = 284;
export const CENTER_X = MAP_WIDTH / 2;
export const CENTER_Y = MAP_HEIGHT / 2;

export function normalizeLongitude(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

export function clampLatitude(value: number): number {
  return Math.max(-78, Math.min(78, value));
}

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

export function getMapViewport(width: number, height: number) {
  const scale = Math.max(0.000001, Math.min(width / MAP_WIDTH, height / MAP_HEIGHT));
  return {
    scale,
    offsetX: (width - MAP_WIDTH * scale) / 2,
    offsetY: (height - MAP_HEIGHT * scale) / 2,
  };
}

export function createGlobeProjection(view: GlobeView): GeoProjection {
  return geoOrthographic()
    .translate([CENTER_X, CENTER_Y])
    .scale(GLOBE_RADIUS * view.zoom)
    .rotate([-view.longitude, -view.latitude, 0])
    .clipAngle(90);
}

export function isFacingCamera(longitude: number, latitude: number, view: GlobeView): boolean {
  return (
    geoDistance([longitude, latitude], [view.longitude, view.latitude]) <= Math.PI / 2 + 0.000001
  );
}

/** Fits small countries more closely without over-zooming large countries. */
export function getCountryView(country: CountryEntry): GlobeView {
  const target = {
    longitude: country.label[0],
    latitude: clampLatitude(country.label[1]),
    zoom: 1,
  };
  const bounds = geoPath(createGlobeProjection(target)).bounds(country.feature);
  const width = Math.max(1, bounds[1][0] - bounds[0][0]);
  const height = Math.max(1, bounds[1][1] - bounds[0][1]);
  const fitZoom = Math.min(540 / width, 410 / height);

  return {
    ...target,
    zoom: clampZoom(Math.max(1.9, Math.min(14, fitZoom))),
  };
}

export function isLocationVisible(
  center: [number, number],
  boundingRadius: number,
  view: GlobeView,
): boolean {
  const viewportAngularRadius = Math.asin(
    Math.min(1, Math.hypot(CENTER_X, CENTER_Y) / (GLOBE_RADIUS * view.zoom)),
  );
  return (
    geoDistance(center, [view.longitude, view.latitude]) <= viewportAngularRadius + boundingRadius
  );
}

function isPotentiallyVisible(country: CountryEntry, view: GlobeView): boolean {
  return isLocationVisible(country.center, country.boundingRadius, view);
}

export function visibleCountries<T extends CountryEntry>(
  countries: readonly T[],
  view: GlobeView,
): T[] {
  return countries.filter((country) => isPotentiallyVisible(country, view));
}

/** Geographic hit-testing keeps canvas clicks aligned with the detailed shapes. */
export function findCountryAtPoint(
  point: [number, number],
  view: GlobeView,
): CountryEntry | undefined {
  if (Math.hypot(point[0] - CENTER_X, point[1] - CENTER_Y) > GLOBE_RADIUS * view.zoom) {
    return undefined;
  }
  const coordinate = createGlobeProjection(view).invert?.(point);
  if (!coordinate || !coordinate.every(Number.isFinite)) return undefined;

  for (const country of COUNTRIES) {
    if (geoDistance(country.center, coordinate) > country.boundingRadius) continue;
    if (geoContains(country.feature, coordinate)) return country;
  }
  return undefined;
}
