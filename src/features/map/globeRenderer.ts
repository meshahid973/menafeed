import { geoContains, geoGraticule, geoPath } from 'd3-geo';
import type { GeoPath, GeoPermissibleObjects, GeoProjection } from 'd3-geo';
import {
  CITIES_BY_COUNTRY,
  CITY_BOUNDING_RADII,
  CONTEXT_COUNTRIES,
  CONTEXT_COUNTRY_BY_CODE,
  COUNTRY_BY_CODE,
  LOW_CONTEXT_COUNTRIES,
  type CityFeature,
} from './mapData';
import { isValidGeoCoordinate } from './geography';
import {
  CENTER_X,
  CENTER_Y,
  createGlobeProjection,
  GLOBE_RADIUS,
  getMapViewport,
  isLocationVisible,
  visibleCountries,
  type GlobeView,
} from './globeView';
import type { MenaMarker } from './types';
import { MAP_HEIGHT, MAP_WIDTH } from './geography';

const GRATICULE = geoGraticule().step([15, 15])();
const MAX_CITY_LABELS = 24;

export interface GlobeFrame {
  projection: GeoProjection;
  countryLabel: [number, number] | null;
  markerPositions: ReadonlyMap<string, [number, number]>;
}

export function validMarker(marker: MenaMarker): boolean {
  return (
    marker.id.trim().length > 0 &&
    marker.label.trim().length > 0 &&
    isValidGeoCoordinate(marker.longitude, marker.latitude)
  );
}

export function normalizePlaceName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function placeNamesMatch(left: string, right: string): boolean {
  const a = normalizePlaceName(left);
  const b = normalizePlaceName(right);
  return (
    a.length > 0 && b.length > 0 && (a === b || a.startsWith(b + ' ') || b.startsWith(a + ' '))
  );
}

/** Match story metadata first, then use coordinates as independent spatial evidence. */
export function findHighlightedCityIds(
  cities: readonly CityFeature[],
  markers: readonly MenaMarker[],
  activeCountry: string,
): Set<string> {
  const highlighted = new Set<string>();
  for (const marker of markers) {
    if (!validMarker(marker)) continue;
    if (marker.countryCode && marker.countryCode !== activeCountry) continue;

    if (marker.cityName) {
      let matchedName = false;
      for (const city of cities) {
        if (city.properties.aliases.some((alias) => placeNamesMatch(alias, marker.cityName!))) {
          highlighted.add(city.properties.id);
          matchedName = true;
        }
      }
      if (matchedName) continue;
    }

    const coordinate: [number, number] = [marker.longitude, marker.latitude];
    for (const city of cities) {
      if (city.geometry.type !== 'Point' && geoContains(city, coordinate)) {
        highlighted.add(city.properties.id);
      }
    }
  }
  return highlighted;
}

function paintGeometry(
  context: CanvasRenderingContext2D,
  path: GeoPath,
  geometry: GeoPermissibleObjects,
  fill: string,
  stroke: string,
  lineWidth: number,
  fillOpacity = 1,
): void {
  context.beginPath();
  path(geometry);
  context.globalAlpha = fillOpacity;
  context.fillStyle = fill;
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.stroke();
}

function drawCityLabels(
  context: CanvasRenderingContext2D,
  cities: readonly CityFeature[],
  projection: GeoProjection,
  view: GlobeView,
  highlightedCityIds: ReadonlySet<string>,
): void {
  if (view.zoom < 1.55) return;
  const placed: Array<{ x: number; y: number; width: number }> = [];
  let labelCount = 0;
  context.font = '500 10px ui-monospace, SFMono-Regular, Consolas, monospace';
  context.textBaseline = 'bottom';
  context.lineJoin = 'round';

  for (const city of cities) {
    if (labelCount >= MAX_CITY_LABELS) break;
    const { name, labelLongitude, labelLatitude, capital, population, id } = city.properties;
    const highlighted = highlightedCityIds.has(id);
    if (!highlighted && !capital && population < 1_000_000) continue;
    if (!isLocationVisible([labelLongitude, labelLatitude], 0, view)) continue;
    const position = projection([labelLongitude, labelLatitude]);
    if (!position || !position.every(Number.isFinite)) continue;
    const x = position[0] + 6;
    const y = position[1] - 6;
    const width = context.measureText(name).width;
    if (
      x - width / 2 < 0 ||
      x + width / 2 > MAP_WIDTH ||
      y < 12 ||
      y > MAP_HEIGHT ||
      placed.some(
        (other) =>
          Math.abs(x - other.x) < (width + other.width) / 2 + 8 && Math.abs(y - other.y) < 14,
      )
    ) {
      continue;
    }

    context.strokeStyle = '#07100e';
    context.lineWidth = 3;
    context.strokeText(name, x, y);
    context.fillStyle = highlighted ? '#e7ffad' : '#e0eadf';
    context.fillText(name, x, y);
    placed.push({ x, y, width });
    labelCount += 1;
  }
}

/**
 * Canvas keeps per-frame projection work out of React and avoids SVG DOM churn.
 * The function still returns projected overlay positions when canvas is unavailable.
 */
export function drawGlobe(
  canvas: HTMLCanvasElement,
  view: GlobeView,
  activeCountry: string | null,
  markers: readonly MenaMarker[],
  highlightedCityIds: ReadonlySet<string>,
  interactive = false,
): GlobeFrame {
  const projection = createGlobeProjection(view);
  const active = activeCountry ? COUNTRY_BY_CODE.get(activeCountry) : undefined;
  const markerPositions = new Map<string, [number, number]>();
  for (const marker of markers) {
    if (!validMarker(marker) || !isLocationVisible([marker.longitude, marker.latitude], 0, view))
      continue;
    const position = projection([marker.longitude, marker.latitude]);
    if (position && position.every(Number.isFinite)) markerPositions.set(marker.id, position);
  }
  const countryLabel =
    active && isLocationVisible(active.label, 0, view) ? projection(active.label) : null;

  const context = canvas.getContext('2d');
  if (!context) return { projection, countryLabel, markerPositions };

  const radius = GLOBE_RADIUS * view.zoom;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#030606';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const viewport = getMapViewport(canvas.width, canvas.height);
  context.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.offsetX, viewport.offsetY);
  context.lineJoin = 'round';
  context.lineCap = 'round';

  const glow = context.createRadialGradient(
    CENTER_X,
    CENTER_Y,
    Math.max(0, radius * 0.65),
    CENTER_X,
    CENTER_Y,
    radius + 34,
  );
  glow.addColorStop(0, 'rgba(92, 158, 124, 0.10)');
  glow.addColorStop(1, 'rgba(92, 158, 124, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(CENTER_X, CENTER_Y, radius + 34, 0, Math.PI * 2);
  context.fill();

  const sphere = context.createRadialGradient(
    CENTER_X - radius * 0.28,
    CENTER_Y - radius * 0.3,
    radius * 0.04,
    CENTER_X,
    CENTER_Y,
    radius,
  );
  sphere.addColorStop(0, '#183033');
  sphere.addColorStop(0.54, '#0b171a');
  sphere.addColorStop(1, '#030708');
  context.fillStyle = sphere;
  context.beginPath();
  context.arc(CENTER_X, CENTER_Y, radius, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.beginPath();
  context.arc(CENTER_X, CENTER_Y, radius, 0, Math.PI * 2);
  context.clip();
  const path = geoPath(projection, context);

  context.beginPath();
  path(GRATICULE);
  context.strokeStyle = 'rgba(45, 74, 72, 0.55)';
  context.lineWidth = 0.65;
  context.setLineDash([2, 4]);
  context.stroke();
  context.setLineDash([]);

  const contextCountries = interactive ? LOW_CONTEXT_COUNTRIES : CONTEXT_COUNTRIES;
  for (const country of visibleCountries(contextCountries, view)) {
    if (country.code === activeCountry) continue;
    paintGeometry(context, path, country.feature, '#20352d', '#718b7c', 0.65, 0.98);
  }
  if (active) {
    const activeGeometry = interactive
      ? (CONTEXT_COUNTRY_BY_CODE.get(active.code)?.feature ?? active.feature)
      : active.feature;
    paintGeometry(context, path, activeGeometry, '#5d7644', '#e2ffa1', 1.35, 1);
  }

  const cities = activeCountry ? (CITIES_BY_COUNTRY.get(activeCountry) ?? []) : [];
  if (activeCountry && view.zoom >= 1.05) {
    for (const city of cities) {
      const highlighted = highlightedCityIds.has(city.properties.id);
      const { labelLongitude, labelLatitude } = city.properties;
      if (
        !isLocationVisible(
          [labelLongitude, labelLatitude],
          CITY_BOUNDING_RADII.get(city) ?? 0,
          view,
        )
      )
        continue;
      if (city.geometry.type === 'Point') {
        const position = projection([labelLongitude, labelLatitude]);
        if (!position) continue;
        context.beginPath();
        context.arc(position[0], position[1], highlighted ? 5 : 2.4, 0, Math.PI * 2);
        context.fillStyle = highlighted ? '#d4fd73' : '#aec7a0';
        context.fill();
        context.strokeStyle = '#07120e';
        context.lineWidth = 0.8;
        context.stroke();
      } else {
        paintGeometry(
          context,
          path,
          city,
          highlighted ? '#d4fd73' : '#b7cda9',
          highlighted ? '#f0ffdb' : '#d7e7c9',
          highlighted ? 1.4 : 0.65,
          highlighted ? 0.52 : 0.2,
        );
      }
    }
    drawCityLabels(context, cities, projection, view, highlightedCityIds);
  }

  context.restore();
  context.beginPath();
  context.arc(CENTER_X, CENTER_Y, radius, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(131, 182, 154, 0.62)';
  context.lineWidth = 1;
  context.stroke();

  return { projection, countryLabel, markerPositions };
}
