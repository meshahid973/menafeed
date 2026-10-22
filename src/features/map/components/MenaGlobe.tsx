import { geoCentroid, geoDistance, geoGraticule, geoOrthographic, geoPath } from 'd3-geo';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, WheelEvent } from 'react';
import rawCountryData from '../data/world-countries.geojson?raw';
import rawCityData from '../data/world-cities.geojson?raw';
import { MENA_COUNTRIES } from '../data/coverage';
import { WORLD_COUNTRIES } from '../worldCountries';
import {
  isValidGeoCoordinate,
  MAP_HEIGHT,
  MAP_WIDTH,
  type CountryCollection,
  type CountryFeature,
} from '../geography';
import type { MenaGlobeProps, MenaMarker } from '../types';
import './MenaGlobe.css';

interface GlobeView {
  longitude: number;
  latitude: number;
  zoom: number;
}

interface DragStart {
  pointerId: number;
  clientX: number;
  clientY: number;
  longitude: number;
  latitude: number;
  zoom: number;
}

const INITIAL_VIEW: GlobeView = { longitude: 24, latitude: 27, zoom: 1 };
const MIN_ZOOM = 0.02;
const GLOBE_RADIUS = 284;
const CITY_LABEL_ZOOM = 1.25;
const CENTER_X = MAP_WIDTH / 2;
const CENTER_Y = MAP_HEIGHT / 2;
const WORLD_FEATURES = JSON.parse(rawCountryData) as CountryCollection;
const COUNTRY_FEATURES = WORLD_FEATURES.features as CountryFeature[];
interface CityFeature {
  type: 'Feature';
  properties: {
    name: string;
    countryName: string;
    countryCode: string;
    population: number;
    capital: boolean;
  };
  geometry: { type: 'Point'; coordinates: [number, number] };
}

interface CityCollection {
  type: 'FeatureCollection';
  features: CityFeature[];
}
const CITY_FEATURES = (JSON.parse(rawCityData) as CityCollection).features;
const COUNTRY_LABELS = COUNTRY_FEATURES.map((feature) => {
  const [longitude, latitude] = geoCentroid(feature);
  return {
    code: feature.properties.code,
    name: feature.properties.name,
    longitude,
    latitude,
  };
}).filter(({ longitude, latitude }) => Number.isFinite(longitude) && Number.isFinite(latitude));
const COUNTRY_LOCATIONS = new Map(
  COUNTRY_LABELS.map(({ code, longitude, latitude }) => [code, { longitude, latitude }]),
);
const VIEW_UPDATE_INTERVAL = 1000 / 30;
const GRATICULE = geoGraticule().step([15, 15])();

function createGlobeProjection(view: GlobeView) {
  return geoOrthographic()
    .translate([CENTER_X, CENTER_Y])
    .scale(GLOBE_RADIUS * view.zoom)
    .rotate([-view.longitude, -view.latitude, 0])
    .clipAngle(90);
}

function normalizeLongitude(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function clampLatitude(value: number): number {
  return Math.max(-78, Math.min(78, value));
}

function formatCoordinate(value: number, axis: 'latitude' | 'longitude'): string {
  const hemisphere = axis === 'latitude' ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E';
  return Math.abs(value).toFixed(2) + '° ' + hemisphere;
}

function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

function validMarker(marker: MenaMarker): boolean {
  return (
    marker.id.trim().length > 0 &&
    marker.label.trim().length > 0 &&
    isValidGeoCoordinate(marker.longitude, marker.latitude)
  );
}

function isFacingCamera(longitude: number, latitude: number, view: GlobeView): boolean {
  return (
    geoDistance([longitude, latitude], [view.longitude, view.latitude]) <=
    Math.PI / 2 + 0.000001
  );
}

/**
 * An offline-first orthographic globe with world-wide country selection.
 * City data is bundled locally, so the globe makes no map-tile requests.
 */
export function MenaGlobe({
  selectedCountry,
  onCountrySelect,
  markers = [],
  onMarkerSelect,
  className,
  ariaLabel = 'Interactive world globe with selectable countries and major cities',
}: MenaGlobeProps) {
  const instanceId = useId().replace(/:/g, '');
  const sphereGradientId = 'signal-globe-sphere-' + instanceId;
  const highlightGradientId = 'signal-globe-highlight-' + instanceId;
  const glowGradientId = 'signal-globe-glow-' + instanceId;
  const clipId = 'signal-globe-clip-' + instanceId;
  const [internalSelection, setInternalSelection] = useState<string | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [view, setView] = useState<GlobeView>(INITIAL_VIEW);
  const dragStartRef = useRef<DragStart | null>(null);
  const didDragRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const wheelFrameRef = useRef<number | null>(null);
  const accumulatedWheelDeltaRef = useRef(0);
  const lastViewUpdateRef = useRef(0);

  const isControlled = selectedCountry !== undefined;
  const activeCountry = isControlled ? selectedCountry : internalSelection;
  const radius = GLOBE_RADIUS * view.zoom;

  const projection = useMemo(() => createGlobeProjection(view), [view]);
  const paths = useMemo(() => {
    const pathGenerator = geoPath(projection);
    return COUNTRY_FEATURES.map((feature) => ({
      feature,
      path: pathGenerator(feature) ?? '',
    })).filter(({ path }) => path.length > 0);
  }, [projection]);
  const graticulePath = useMemo(() => geoPath(projection)(GRATICULE) ?? '', [projection]);
  const visibleMarkers = useMemo(
    () =>
      markers
        .filter(validMarker)
        .filter((marker) => isFacingCamera(marker.longitude, marker.latitude, view))
        .map((marker) => ({ marker, position: projection([marker.longitude, marker.latitude]) }))
        .filter(
          (entry): entry is { marker: MenaMarker; position: [number, number] } =>
            entry.position !== null && entry.position.every(Number.isFinite),
        ),
    [markers, projection, view],
  );
  const visibleCities = useMemo(() => {
    if (!activeCountry) return [];
    return CITY_FEATURES.flatMap((feature) => {
      if (feature.properties.countryCode !== activeCountry) return [];
      const [longitude, latitude] = feature.geometry.coordinates;
      if (!isFacingCamera(longitude, latitude, view)) return [];
      const position = projection([longitude, latitude]);
      return position && position.every(Number.isFinite) ? [{ feature, position }] : [];
    });
  }, [activeCountry, projection, view]);

  const visibleCountryLabels = useMemo(() => {
    if (view.zoom < 0.88) return [];
    const minimumDistance = view.zoom < 1.18 ? 66 : view.zoom < 1.7 ? 43 : view.zoom < 2.5 ? 28 : 16;
    const candidates = COUNTRY_LABELS.flatMap((country) => {
      if (!isFacingCamera(country.longitude, country.latitude, view)) return [];
      const position = projection([country.longitude, country.latitude]);
      if (!position || !position.every(Number.isFinite)) return [];
      return [{
        ...country,
        x: position[0],
        y: position[1],
        width: Math.max(22, country.name.length * 4.7),
      }];
    }).sort((a, b) => {
      if (a.code === activeCountry) return -1;
      if (b.code === activeCountry) return 1;
      const aDistance = Math.hypot(a.x - CENTER_X, a.y - CENTER_Y);
      const bDistance = Math.hypot(b.x - CENTER_X, b.y - CENTER_Y);
      return aDistance - bDistance;
    });

    const placed: typeof candidates = [];
    for (const candidate of candidates) {
      const overlaps = placed.some((other) =>
        Math.abs(candidate.x - other.x) < (candidate.width + other.width) / 2 + 7 &&
        Math.abs(candidate.y - other.y) < minimumDistance * 0.28 + 6,
      );
      if (!overlaps) placed.push(candidate);
    }
    return placed;
  }, [activeCountry, projection, view]);

  const selectCountry = useCallback(
    (country: string | null) => {
      if (!isControlled) setInternalSelection(country);
      onCountrySelect?.(country);
    },
    [isControlled, onCountrySelect],
  );

  const currentCountry = WORLD_COUNTRIES.find(({ code }) => code === activeCountry);
  const hoveredFeature = hoveredCountry
    ? COUNTRY_FEATURES.find(({ properties }) => properties.code === hoveredCountry)
    : undefined;
  const mapClassName = ['signal-map', className].filter(Boolean).join(' ');

  const startPan = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;

      dragStartRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        longitude: view.longitude,
        latitude: view.latitude,
        zoom: view.zoom,
      };
      didDragRef.current = false;
    },
    [view.latitude, view.longitude, view.zoom],
  );

  const movePan = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.clientX;
    const deltaY = event.clientY - start.clientY;
    if (!didDragRef.current && Math.hypot(deltaX, deltaY) > 4) {
      didDragRef.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (!didDragRef.current) return;

    const now = performance.now();
    if (now - lastViewUpdateRef.current < VIEW_UPDATE_INTERVAL) return;
    lastViewUpdateRef.current = now;
    const degreesPerPixel = 90 / (GLOBE_RADIUS * start.zoom);
    setView({
      longitude: normalizeLongitude(start.longitude - deltaX * degreesPerPixel),
      latitude: clampLatitude(start.latitude + deltaY * degreesPerPixel),
      zoom: start.zoom,
    });
  }, []);

  const endPan = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.clientX;
    const deltaY = event.clientY - start.clientY;
    if (Math.hypot(deltaX, deltaY) > 4) {
      didDragRef.current = true;
      const degreesPerPixel = 90 / (GLOBE_RADIUS * start.zoom);
      setView({
        longitude: normalizeLongitude(start.longitude - deltaX * degreesPerPixel),
        latitude: clampLatitude(start.latitude + deltaY * degreesPerPixel),
        zoom: start.zoom,
      });
    }

    dragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (didDragRef.current) window.setTimeout(() => { didDragRef.current = false; }, 0);
  }, []);

  const zoomAt = useCallback((factor: number) => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    setView((current) => ({ ...current, zoom: Math.max(MIN_ZOOM, current.zoom * factor) }));
  }, []);

  const animateViewTo = useCallback((target: GlobeView, duration = 900) => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    const start = view;
    const longitudeDelta = normalizeLongitude(target.longitude - start.longitude);
    const startTime = performance.now();
    const motionDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : duration;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startTime) / motionDuration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const zoomBase = start.zoom + (target.zoom - start.zoom) * eased;
      const zoom = zoomBase * (1 - 0.12 * Math.sin(Math.PI * progress));
      if (progress >= 1 || now - lastViewUpdateRef.current >= VIEW_UPDATE_INTERVAL) {
        lastViewUpdateRef.current = now;
        setView(progress >= 1 ? target : {
          longitude: normalizeLongitude(start.longitude + longitudeDelta * eased),
          latitude: start.latitude + (target.latitude - start.latitude) * eased,
          zoom: Math.max(MIN_ZOOM, zoom),
        });
      }
      if (progress < 1) animationFrameRef.current = requestAnimationFrame(animate);
      else animationFrameRef.current = null;
    };
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [view]);

  const animateToCountry = useCallback((code: string) => {
    const location = COUNTRY_LOCATIONS.get(code);
    if (!location) return;
    animateViewTo({
      longitude: location.longitude,
      latitude: clampLatitude(location.latitude),
      zoom: 2.55,
    }, 920);
  }, [animateViewTo]);

  const resetGlobe = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    const start = view;
    const longitudeTravel = normalizeLongitude(INITIAL_VIEW.longitude - start.longitude) + 360;
    const startTime = performance.now();
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1150;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const interpolatedZoom = start.zoom + (INITIAL_VIEW.zoom - start.zoom) * eased;
      const zoom = interpolatedZoom * (1 - 0.28 * Math.sin(Math.PI * progress));
      if (progress >= 1 || now - lastViewUpdateRef.current >= VIEW_UPDATE_INTERVAL) {
        lastViewUpdateRef.current = now;
        setView(progress >= 1 ? INITIAL_VIEW : {
          longitude: normalizeLongitude(start.longitude + longitudeTravel * eased),
          latitude: start.latitude + (INITIAL_VIEW.latitude - start.latitude) * eased,
          zoom: Math.max(MIN_ZOOM, zoom),
        });
      }
      if (progress < 1) animationFrameRef.current = requestAnimationFrame(animate);
      else animationFrameRef.current = null;
    };
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [view]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    if (wheelFrameRef.current !== null) cancelAnimationFrame(wheelFrameRef.current);
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      accumulatedWheelDeltaRef.current += event.deltaY;
      if (wheelFrameRef.current !== null) return;

      const flushWheelZoom = (now: number) => {
        if (now - lastViewUpdateRef.current < VIEW_UPDATE_INTERVAL) {
          wheelFrameRef.current = requestAnimationFrame(flushWheelZoom);
          return;
        }
        const delta = accumulatedWheelDeltaRef.current;
        accumulatedWheelDeltaRef.current = 0;
        wheelFrameRef.current = null;
        lastViewUpdateRef.current = now;
        setView((current) => ({
          ...current,
          zoom: Math.max(MIN_ZOOM, current.zoom * Math.exp(-delta * 0.0012)),
        }));
      };
      wheelFrameRef.current = requestAnimationFrame(flushWheelZoom);
    },
    [],
  );

  const handleMapKeyDown = useCallback(
    (event: KeyboardEvent<SVGSVGElement>) => {
      if (event.key === 'Escape') {
        selectCountry(null);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomAt(1.2);
      } else if (event.key === '-') {
        event.preventDefault();
        zoomAt(1 / 1.2);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setView((current) => ({
          ...current,
          longitude: normalizeLongitude(current.longitude - 10),
        }));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setView((current) => ({
          ...current,
          longitude: normalizeLongitude(current.longitude + 10),
        }));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setView((current) => ({
          ...current,
          latitude: clampLatitude(current.latitude + 10),
        }));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setView((current) => ({
          ...current,
          latitude: clampLatitude(current.latitude - 10),
        }));
      }
    },
    [selectCountry, zoomAt],
  );

  return (
    <section className={mapClassName} aria-label={ariaLabel}>
      <header className="signal-map__header">
        <div>
          <p className="signal-map__eyebrow">GEOGRAPHIC INTELLIGENCE / 01</p>
          <h2 className="signal-map__heading">Global context</h2>
        </div>
        <div className="signal-map__header-actions">
          <span className="signal-map__coverage-count">
            {COUNTRY_FEATURES.length} COUNTRY &amp; TERRITORY BOUNDARIES
          </span>
          <button
            className="signal-map__clear"
            type="button"
            onClick={() => selectCountry(null)}
            disabled={activeCountry === null}
          >
            Clear selection <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      <div className="signal-map__stage">
        <div className="signal-map__stage-meta" aria-hidden="true">
          <span>ORTHOGRAPHIC / WGS84</span>
          <span>{hoveredFeature?.properties.name ?? 'WORLD / COUNTRY BOUNDARIES'}</span>
        </div>
        <svg
          className="signal-map__svg"
          viewBox={'0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT}
          role="region"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onWheel={handleWheel}
          onKeyDown={handleMapKeyDown}
          data-testid="mena-map"
        >
          <defs>
            <radialGradient id={sphereGradientId} cx="31%" cy="24%" r="79%">
              <stop offset="0%" stopColor="#183033" />
              <stop offset="54%" stopColor="#0b171a" />
              <stop offset="100%" stopColor="#030708" />
            </radialGradient>
            <radialGradient id={highlightGradientId} cx="27%" cy="17%" r="75%">
              <stop offset="0%" stopColor="#b5e6b2" stopOpacity="0.16" />
              <stop offset="56%" stopColor="#a5d4bd" stopOpacity="0.035" />
              <stop offset="100%" stopColor="#a5d4bd" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={glowGradientId} cx="50%" cy="50%" r="50%">
              <stop offset="65%" stopColor="#5c9e7c" stopOpacity="0.13" />
              <stop offset="100%" stopColor="#5c9e7c" stopOpacity="0" />
            </radialGradient>
            <clipPath id={clipId}>
              <circle cx={CENTER_X} cy={CENTER_Y} r={radius} />
            </clipPath>
          </defs>

          <rect
            className="signal-map__background"
            x="0"
            y="0"
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
          />
          <circle
            className="signal-map__sphere-glow"
            cx={CENTER_X}
            cy={CENTER_Y}
            r={radius + 34}
            fill={'url(#' + glowGradientId + ')'}
          />
          <circle
            className="signal-map__sphere-base"
            cx={CENTER_X}
            cy={CENTER_Y}
            r={radius}
            fill={'url(#' + sphereGradientId + ')'}
          />
          <circle
            className="signal-map__sphere-highlight"
            cx={CENTER_X}
            cy={CENTER_Y}
            r={radius}
            fill={'url(#' + highlightGradientId + ')'}
          />

          <g clipPath={'url(#' + clipId + ')'}>
            <path className="signal-map__graticule" d={graticulePath} aria-hidden="true" />
            <g data-testid="map-layer">
              {paths.map(({ feature, path }) => {
                const { code, name } = feature.properties;
                const countryCode =
                  isCountryCode(code) && feature.geometry.type !== 'Point' ? code : null;
                const canSelect = countryCode !== null;
                const selected = canSelect && activeCountry === countryCode;
                const hovered = hoveredCountry === code;

                return (
                  <path
                    key={code}
                    d={path}
                    className={[
                      'signal-map__country',
                      canSelect
                        ? 'signal-map__country--selectable'
                        : 'signal-map__country--context',
                      selected ? 'signal-map__country--selected' : '',
                      hovered ? 'signal-map__country--hovered' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-country-code={code}
                    role={canSelect ? 'button' : undefined}
                    tabIndex={canSelect ? 0 : undefined}
                    aria-label={canSelect ? 'Select ' + name : undefined}
                    aria-pressed={canSelect ? selected : undefined}
                    onClick={
                      canSelect && countryCode
                        ? () => {
                            if (didDragRef.current) {
                              didDragRef.current = false;
                              return;
                            }
                            selectCountry(countryCode);
                            animateToCountry(countryCode);
                          }
                        : undefined
                    }
                    onKeyDown={
                      canSelect && countryCode
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              selectCountry(countryCode);
                              animateToCountry(countryCode);
                            }
                          }
                        : undefined
                    }
                    onMouseEnter={() => setHoveredCountry(code)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    onFocus={() => setHoveredCountry(code)}
                    onBlur={() => setHoveredCountry(null)}
                  >
                    <title>{canSelect ? name + ' · select country' : name}</title>
                  </path>
                );
              })}
              {visibleCountryLabels.length > 0 && (
                <g className="signal-map__country-labels" data-testid="country-label-layer" aria-hidden="true">
                  {visibleCountryLabels.map((country) => (
                    <text key={country.code} x={country.x} y={country.y} textAnchor="middle">
                      {country.name}
                    </text>
                  ))}
                </g>
              )}
              {visibleCities.length > 0 && (
                <g data-testid="city-layer">
                  {visibleCities.map(({ feature, position }) => (
                <g className="signal-map__city" key={feature.properties.name} aria-hidden="true">
                  <circle cx={position[0]} cy={position[1]} r="2.1" />
                  {view.zoom >= CITY_LABEL_ZOOM &&
                    (feature.properties.capital || feature.properties.population >= 1_500_000) && (
                      <text x={position[0] + 5} y={position[1] - 5}>
                        {feature.properties.name}
                      </text>
                    )}
                  <title>
                    {feature.properties.name}
                    {feature.properties.countryName ? ', ' + feature.properties.countryName : ''}
                  </title>
                </g>
                  ))}
                </g>
              )}
              {visibleMarkers.map(({ marker, position }) => (
                <g
                  key={marker.id}
                  className="signal-map__marker"
                  data-marker-id={marker.id}
                  role={onMarkerSelect ? 'button' : 'img'}
                  tabIndex={onMarkerSelect ? 0 : undefined}
                  aria-label={
                    marker.label +
                    ', ' +
                    formatCoordinate(marker.latitude, 'latitude') +
                    ', ' +
                    formatCoordinate(marker.longitude, 'longitude')
                  }
                  onClick={() => {
                    if (didDragRef.current) {
                      didDragRef.current = false;
                      return;
                    }
                    onMarkerSelect?.(marker);
                  }}
                  onKeyDown={(event) => {
                    if (onMarkerSelect && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      onMarkerSelect(marker);
                    }
                  }}
                >
                  <circle
                    cx={position[0]}
                    cy={position[1]}
                    r="12"
                    className="signal-map__marker-halo"
                  />
                  <circle
                    cx={position[0]}
                    cy={position[1]}
                    r="3.5"
                    className="signal-map__marker-dot"
                  />
                  <title>
                    {marker.label} · {formatCoordinate(marker.latitude, 'latitude')},{' '}
                    {formatCoordinate(marker.longitude, 'longitude')}
                    {marker.detail ? ' · ' + marker.detail : ''}
                  </title>
                </g>
              ))}
            </g>
          </g>

          <circle
            className="signal-map__sphere-outline"
            cx={CENTER_X}
            cy={CENTER_Y}
            r={radius}
            aria-hidden="true"
          />
          <text x="28" y="34" className="signal-map__corner-label">
            WORLD / NATURAL EARTH
          </text>
          <text x="972" y="34" textAnchor="end" className="signal-map__corner-label">
            DRAG TO ROTATE
          </text>
          <text x="28" y="617" className="signal-map__coordinate-label">
            GLOBAL / 110M REFERENCE
          </text>
          <text x="972" y="617" textAnchor="end" className="signal-map__coordinate-label">
            GLOBAL COUNTRY COVERAGE
          </text>
        </svg>

        <div className="signal-map__zoom-controls" aria-label="Globe navigation controls">
          <button type="button" onClick={() => zoomAt(1.2)} aria-label="Zoom in">
            <ZoomIn size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => zoomAt(1 / 1.2)} aria-label="Zoom out">
            <ZoomOut size={18} aria-hidden="true" />
          </button>
          <span aria-hidden="true" />
          <button
            type="button"
            onClick={resetGlobe}
            aria-label="Animate reset globe view"
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="signal-map__stage-hint" aria-hidden="true">
          Drag to rotate <span>·</span> Scroll to zoom <span>·</span> Select any country
        </div>
      </div>

      <div className="signal-map__selection" aria-live="polite" aria-atomic="true">
        <div>
          <span className="signal-map__selection-label">ACTIVE TERRITORY</span>
          <span className="signal-map__selection-value">
            {currentCountry ? currentCountry.name : 'No country selected'}
          </span>
        </div>
        {activeCountry && <span className="signal-map__country-code">{activeCountry}</span>}
      </div>

      <div className="signal-map__country-panel">
        <div className="signal-map__country-panel-heading">
          <span>SELECT BY COUNTRY</span>
          <span>{MENA_COUNTRIES.length.toString().padStart(2, '0')} MENA SHORTCUTS</span>
        </div>
        <div className="signal-map__country-list" aria-label="Choose a MENA country">
          {MENA_COUNTRIES.map(({ code, name }) => (
            <button
              key={code}
              type="button"
              className={[
                'signal-map__country-option',
                activeCountry === code ? 'signal-map__country-option--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={activeCountry === code}
              onClick={() => {
                selectCountry(code);
                animateToCountry(code);
              }}
            >
              <span>{name}</span>
              <span className="signal-map__country-option-code">{code}</span>
            </button>
          ))}
        </div>
      </div>

      <footer className="signal-map__footer">
        <span>
          <i aria-hidden="true" /> WORLD COUNTRY BOUNDARIES / NATURAL EARTH 1:110M
        </span>
        <span>GEOGRAPHIC DATA BUNDLED OFFLINE</span>
      </footer>
    </section>
  );
}
