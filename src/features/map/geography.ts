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

export function projectCoordinate(longitude: number, latitude: number): [number, number] | null {
  if (!isValidGeoCoordinate(longitude, latitude)) return null;
  const point = MENA_PROJECTION([longitude, latitude]);
  if (!point || !point.every(Number.isFinite)) return null;
  return [point[0], point[1]];
}

export function isValidGeoCoordinate(longitude: number, latitude: number): boolean {
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

export interface CountryFocus {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in degrees that brings the country's principal axis upright. */
  rotation: number;
}

function outerRings(feature: CountryFeature): number[][][] {
  const geometry = feature.geometry;
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];
    return ring ? [ring as number[][]] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((polygon) =>
      polygon[0] ? [polygon[0] as number[][]] : [],
    );
  }
  return [];
}

function projectedRingArea(points: readonly [number, number][]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area / 2);
}

function uprightRotation(points: readonly [number, number][]): number {
  if (points.length < 3) return 0;
  const meanX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const [x, y] of points) {
    const dx = x - meanX;
    const dy = y - meanY;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  const trace = xx + yy;
  if (trace < 1e-6) return 0;
  const discriminant = Math.hypot(xx - yy, 2 * xy);
  const major = (trace + discriminant) / 2;
  const minor = (trace - discriminant) / 2;
  // Nearly round shapes have no stable principal axis; avoid arbitrary spins.
  if (minor <= 0 || major / minor < 1.2) return 0;

  const principalAngle = (0.5 * Math.atan2(2 * xy, xx - yy) * 180) / Math.PI;
  const candidates = [90 - principalAngle, -90 - principalAngle].map((angle) => {
    let normalized = ((((angle + 180) % 360) + 360) % 360) - 180;
    if (normalized > 90) normalized -= 180;
    if (normalized < -90) normalized += 180;
    return normalized;
  });
  return candidates.reduce((best, value) => (Math.abs(value) < Math.abs(best) ? value : best));
}

/**
 * Computes a camera target from projected country geometry, not a hardcoded
 * per-country rotation. The centroid keeps the country centred while the
 * principal axis supplies a restrained upright adjustment.
 */
export function getCountryFocus(feature: CountryFeature): CountryFocus | null {
  const [[x0, y0], [x1, y1]] = COUNTRY_PATH.bounds(feature);
  const [centroidX, centroidY] = COUNTRY_PATH.centroid(feature);
  if (![x0, y0, x1, y1, centroidX, centroidY].every(Number.isFinite)) return null;
  const width = x1 - x0;
  const height = y1 - y0;
  if (width <= 0 || height <= 0) return null;

  const projectedRings = outerRings(feature).map((ring) =>
    ring.flatMap((position): [number, number][] => {
      const longitude = position[0];
      const latitude = position[1];
      if (longitude === undefined || latitude === undefined) return [];
      const point = MENA_PROJECTION([longitude, latitude]);
      return point && point.every(Number.isFinite) ? [[point[0], point[1]]] : [];
    }),
  );
  const principalRing = projectedRings
    .filter((ring) => ring.length >= 3)
    .sort((left, right) => projectedRingArea(right) - projectedRingArea(left))[0];

  return {
    x: centroidX >= x0 && centroidX <= x1 ? centroidX : (x0 + x1) / 2,
    y: centroidY >= y0 && centroidY <= y1 ? centroidY : (y0 + y1) / 2,
    width,
    height,
    rotation: principalRing ? uprightRotation(principalRing) : 0,
  };
}
