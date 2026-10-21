import { geoGraticule, geoPath } from 'd3-geo';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, WheelEvent } from 'react';
import rawCountryData from '../data/mena-countries.geojson?raw';
import { MENA_COUNTRIES } from '../data/coverage';
import {
  createMenaProjection,
  isInsideMap,
  isValidGeoCoordinate,
  MAP_HEIGHT,
  MAP_WIDTH,
  markerPosition,
  type CountryCollection,
  type CountryFeature,
} from '../geography';
import type { MenaGlobeProps, MenaMarker, MenaCountryCode } from '../types';
import './MenaGlobe.css';

interface ViewTransform {
  panX: number;
  panY: number;
  zoom: number;
}

interface DragStart {
  pointerId: number;
  clientX: number;
  clientY: number;
  panX: number;
  panY: number;
  zoom: number;
}

const INITIAL_VIEW: ViewTransform = { panX: 0, panY: 0, zoom: 1 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.25;
const REGION_FEATURES = JSON.parse(rawCountryData) as CountryCollection;
const MAP_PROJECTION = createMenaProjection();
const MAP_PATH = geoPath(MAP_PROJECTION);
const GRATICULE_PATH = MAP_PATH(geoGraticule().step([10, 10])()) ?? '';

function transformString(view: ViewTransform): string {
  return `translate(${view.panX} ${view.panY}) scale(${view.zoom})`;
}

function formatCoordinate(value: number, axis: 'latitude' | 'longitude'): string {
  const hemisphere = axis === 'latitude' ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E';
  return `${Math.abs(value).toFixed(2)}° ${hemisphere}`;
}

function isCountryCode(value: string): value is MenaCountryCode {
  return MENA_COUNTRIES.some((country) => country.code === value);
}

function validMarker(marker: MenaMarker): boolean {
  return (
    marker.id.trim().length > 0 &&
    marker.label.trim().length > 0 &&
    isValidGeoCoordinate(marker.longitude, marker.latitude)
  );
}

/**
 * An offline-first regional map. The component owns country/hover/pan state;
 * selectedCountry becomes controlled whenever the prop is provided (including null).
 */
export function MenaGlobe({
  selectedCountry,
  onCountrySelect,
  markers = [],
  onMarkerSelect,
  className,
  ariaLabel = 'Interactive map of the Middle East and North Africa',
}: MenaGlobeProps) {
  const instanceId = useId().replace(/:/g, '');
  const gridPatternId = `signal-map-grid-${instanceId}`;
  const clipId = `signal-map-clip-${instanceId}`;
  const [internalSelection, setInternalSelection] = useState<MenaCountryCode | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<MenaCountryCode | null>(null);
  const [view, setView] = useState<ViewTransform>(INITIAL_VIEW);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mapLayerRef = useRef<SVGGElement | null>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const didDragRef = useRef(false);

  const isControlled = selectedCountry !== undefined;
  const activeCountry = isControlled ? selectedCountry : internalSelection;

  const paths = useMemo(
    () =>
      REGION_FEATURES.features.map((feature) => ({
        feature: feature as CountryFeature,
        path: MAP_PATH(feature as CountryFeature) ?? '',
      })),
    [],
  );
  const visibleMarkers = useMemo(
    () =>
      markers
        .filter(validMarker)
        .map((marker) => ({ marker, position: markerPosition(marker) }))
        .filter(
          (entry): entry is { marker: MenaMarker; position: [number, number] } =>
            entry.position !== null && isInsideMap(entry.position),
        ),
    [markers],
  );

  const selectCountry = useCallback(
    (country: MenaCountryCode | null) => {
      if (!isControlled) setInternalSelection(country);
      onCountrySelect?.(country);
    },
    [isControlled, onCountrySelect],
  );

  const currentCountry = MENA_COUNTRIES.find(({ code }) => code === activeCountry);
  const mapClassName = ['signal-map', className].filter(Boolean).join(' ');

  const pointInMap = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * MAP_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * MAP_HEIGHT,
    };
  }, []);

  const startPan = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      const target = event.target as Element;
      const startedOnControl = Boolean(target.closest('[data-country-code], [data-marker-id]'));
      const point = pointInMap(event);
      if (!point) return;
      dragStartRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        panX: view.panX,
        panY: view.panY,
        zoom: view.zoom,
      };
      didDragRef.current = false;
      if (!startedOnControl && event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [pointInMap, view.panX, view.panY, view.zoom],
  );

  const movePan = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const start = dragStartRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!start || start.pointerId !== event.pointerId || rect.width <= 0 || rect.height <= 0)
      return;

    const deltaX = ((event.clientX - start.clientX) / rect.width) * MAP_WIDTH;
    const deltaY = ((event.clientY - start.clientY) / rect.height) * MAP_HEIGHT;
    if (Math.hypot(deltaX, deltaY) > 3 && !didDragRef.current) {
      didDragRef.current = true;
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    if (!didDragRef.current) return;
    const next = {
      zoom: start.zoom,
      panX: Math.max(-MAP_WIDTH * 0.8, Math.min(MAP_WIDTH * 0.8, start.panX + deltaX)),
      panY: Math.max(-MAP_HEIGHT * 0.8, Math.min(MAP_HEIGHT * 0.8, start.panY + deltaY)),
    };
    if (mapLayerRef.current) {
      mapLayerRef.current.setAttribute('transform', transformString(next));
    }
  }, []);

  const endPan = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const start = dragStartRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const next =
        rect.width > 0 && rect.height > 0
          ? {
              ...view,
              panX: Math.max(
                -MAP_WIDTH * 0.8,
                Math.min(
                  MAP_WIDTH * 0.8,
                  start.panX + ((event.clientX - start.clientX) / rect.width) * MAP_WIDTH,
                ),
              ),
              panY: Math.max(
                -MAP_HEIGHT * 0.8,
                Math.min(
                  MAP_HEIGHT * 0.8,
                  start.panY + ((event.clientY - start.clientY) / rect.height) * MAP_HEIGHT,
                ),
              ),
            }
          : view;
      dragStartRef.current = null;
      setView(next);
      const target = event.target as Element;
      if (!target.closest('[data-country-code], [data-marker-id]')) didDragRef.current = false;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [view],
  );

  const zoomAt = useCallback(
    (factor: number, anchorX = MAP_WIDTH / 2, anchorY = MAP_HEIGHT / 2) => {
      setView((current) => {
        const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.zoom * factor));
        const relativeZoom = zoom / current.zoom;
        return {
          zoom,
          panX: anchorX - (anchorX - current.panX) * relativeZoom,
          panY: anchorY - (anchorY - current.panY) * relativeZoom,
        };
      });
    },
    [],
  );

  const handleWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const anchorX =
        rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * MAP_WIDTH : MAP_WIDTH / 2;
      const anchorY =
        rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * MAP_HEIGHT : MAP_HEIGHT / 2;
      zoomAt(Math.exp(-event.deltaY * 0.0015), anchorX, anchorY);
    },
    [zoomAt],
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
        setView((current) => ({ ...current, panX: current.panX + 24 }));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setView((current) => ({ ...current, panX: current.panX - 24 }));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setView((current) => ({ ...current, panY: current.panY + 24 }));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setView((current) => ({ ...current, panY: current.panY - 24 }));
      }
    },
    [selectCountry, zoomAt],
  );

  return (
    <section className={mapClassName} aria-label={ariaLabel}>
      <header className="signal-map__header">
        <div>
          <p className="signal-map__eyebrow">GEOGRAPHIC INTELLIGENCE / 01</p>
          <h2 className="signal-map__heading">Regional coverage</h2>
        </div>
        <div className="signal-map__header-actions">
          <span className="signal-map__coverage-count">27 COUNTRIES / TERRITORIES</span>
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
          <span>REGION / MENA</span>
          <span>WGS84 · LON / LAT</span>
        </div>
        <svg
          ref={svgRef}
          className="signal-map__svg"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
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
            <pattern id={gridPatternId} width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" className="signal-map__grid-pattern" />
            </pattern>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} />
            </clipPath>
          </defs>
          <rect
            className="signal-map__background"
            x="0"
            y="0"
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            fill={`url(#${gridPatternId})`}
          />
          <g clipPath={`url(#${clipId})`}>
            <g ref={mapLayerRef} transform={transformString(view)} data-testid="map-layer">
              <path className="signal-map__graticule" d={GRATICULE_PATH} aria-hidden="true" />
              {paths.map(({ feature, path }) => {
                if (!path) return null;
                const { code, name, selectable } = feature.properties;
                const countryCode = isCountryCode(code) ? code : null;
                const selected = countryCode !== null && activeCountry === countryCode;
                const hovered = countryCode !== null && hoveredCountry === countryCode;
                return (
                  <path
                    key={code}
                    d={path}
                    className={[
                      'signal-map__country',
                      selectable
                        ? 'signal-map__country--selectable'
                        : 'signal-map__country--context',
                      selected ? 'signal-map__country--selected' : '',
                      hovered ? 'signal-map__country--hovered' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-country-code={selectable ? code : undefined}
                    role={selectable ? 'button' : undefined}
                    tabIndex={selectable ? 0 : undefined}
                    aria-label={selectable ? `Select ${name}` : undefined}
                    aria-pressed={selectable ? selected : undefined}
                    onClick={
                      selectable && countryCode
                        ? () => {
                            if (didDragRef.current) {
                              didDragRef.current = false;
                              return;
                            }
                            selectCountry(countryCode);
                          }
                        : undefined
                    }
                    onKeyDown={
                      selectable && countryCode
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              selectCountry(countryCode);
                            }
                          }
                        : undefined
                    }
                    onMouseEnter={
                      selectable && countryCode ? () => setHoveredCountry(countryCode) : undefined
                    }
                    onMouseLeave={selectable ? () => setHoveredCountry(null) : undefined}
                    onFocus={
                      selectable && countryCode ? () => setHoveredCountry(countryCode) : undefined
                    }
                    onBlur={selectable ? () => setHoveredCountry(null) : undefined}
                  >
                    <title>{selectable ? `${name} · select country` : name}</title>
                  </path>
                );
              })}
              {visibleMarkers.map(({ marker, position }) => (
                <g
                  key={marker.id}
                  className="signal-map__marker"
                  data-marker-id={marker.id}
                  role={onMarkerSelect ? 'button' : 'img'}
                  tabIndex={onMarkerSelect ? 0 : undefined}
                  aria-label={`${marker.label}, ${formatCoordinate(marker.latitude, 'latitude')}, ${formatCoordinate(marker.longitude, 'longitude')}`}
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
                    r="9"
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
                    {marker.detail ? ` · ${marker.detail}` : ''}
                  </title>
                </g>
              ))}
            </g>
          </g>
          <text x="18" y="30" className="signal-map__corner-label">
            NORTH AFRICA
          </text>
          <text x="982" y="30" textAnchor="end" className="signal-map__corner-label">
            WEST ASIA
          </text>
          <text x="18" y="620" className="signal-map__coordinate-label">
            18°W — 67°E
          </text>
          <text x="982" y="620" textAnchor="end" className="signal-map__coordinate-label">
            04°S — 54°N
          </text>
        </svg>

        <div className="signal-map__zoom-controls" aria-label="Map navigation controls">
          <button type="button" onClick={() => zoomAt(1.25)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomAt(1 / 1.25)} aria-label="Zoom out">
            −
          </button>
          <span aria-hidden="true" />
          <button type="button" onClick={() => setView(INITIAL_VIEW)} aria-label="Reset map view">
            ↺
          </button>
        </div>
        <div className="signal-map__stage-hint" aria-hidden="true">
          Drag to pan <span>·</span> Scroll to zoom <span>·</span> Select a country
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
          <span>{MENA_COUNTRIES.length.toString().padStart(2, '0')} AVAILABLE</span>
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
              onClick={() => selectCountry(code)}
            >
              <span>{name}</span>
              <span className="signal-map__country-option-code">{code}</span>
            </button>
          ))}
        </div>
      </div>

      <footer className="signal-map__footer">
        <span>
          <i aria-hidden="true" /> COUNTRY BOUNDARIES / CARTOGRAPHIC REFERENCE
        </span>
        <span>NO LIVE NEWS DATA CONNECTED</span>
      </footer>
    </section>
  );
}
