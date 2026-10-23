import { geoDistance, geoInterpolate } from 'd3-geo';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent, WheelEvent } from 'react';
import { MENA_COUNTRIES } from '../data/coverage';
import { MAP_HEIGHT, MAP_WIDTH } from '../geography';
import {
  CITIES_BY_COUNTRY,
  COUNTRY_BY_CODE,
  isCountryCode,
  SELECTABLE_COUNTRIES,
} from '../mapData';
import { drawGlobe, findHighlightedCityIds, validMarker, type GlobeFrame } from '../globeRenderer';
import {
  clampLatitude,
  clampZoom,
  createGlobeProjection,
  findCountryAtPoint,
  getCountryView,
  GLOBE_RADIUS,
  getMapViewport,
  INITIAL_VIEW,
  normalizeLongitude,
  type GlobeView,
} from '../globeView';
import type { MenaGlobeProps } from '../types';
import './MenaGlobe.css';

interface DragStart {
  pointerId: number;
  clientX: number;
  clientY: number;
  longitude: number;
  latitude: number;
  zoom: number;
  unitsPerPixel: number;
}

const INITIAL_PROJECTION = createGlobeProjection(INITIAL_VIEW);

function requestFrame(callback: FrameRequestCallback): number {
  return typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(() => callback(performance.now()), 16);
}

function cancelFrame(frame: number): void {
  if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame);
  else window.clearTimeout(frame);
}

function formatCoordinate(value: number, axis: 'latitude' | 'longitude'): string {
  const hemisphere = axis === 'latitude' ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E';
  return Math.abs(value).toFixed(2) + '° ' + hemisphere;
}

function reducedMotionRequested(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Offline Natural Earth geography with a canvas renderer and accessible HTML controls. */
export function MenaGlobe({
  selectedCountry,
  onCountrySelect,
  markers = [],
  onMarkerSelect,
  className,
  ariaLabel = 'Interactive world globe with selectable countries and city boundaries',
}: MenaGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countryLabelRef = useRef<SVGTextElement>(null);
  const markerElementsRef = useRef(new Map<string, SVGGElement>());
  const [internalSelection, setInternalSelection] = useState<string | null>(null);
  const isControlled = selectedCountry !== undefined;
  const activeCountry = isControlled ? selectedCountry : internalSelection;
  const viewRef = useRef<GlobeView>({ ...INITIAL_VIEW });
  const dragStartRef = useRef<DragStart | null>(null);
  const didDragRef = useRef(false);
  const drawFrameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wheelFrameRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const interactiveRef = useRef(false);
  const accumulatedWheelDeltaRef = useRef(0);
  const previousCountryRef = useRef<string | null>(null);
  const handledSelectionRef = useRef<string | null | undefined>(undefined);

  const validMarkers = useMemo(() => markers.filter(validMarker), [markers]);
  const activeCities = useMemo(
    () => (activeCountry ? (CITIES_BY_COUNTRY.get(activeCountry) ?? []) : []),
    [activeCountry],
  );
  const highlightedCityIds = useMemo(
    () =>
      activeCountry
        ? findHighlightedCityIds(activeCities, validMarkers, activeCountry)
        : new Set<string>(),
    [activeCountry, activeCities, validMarkers],
  );
  const currentCountry = activeCountry ? COUNTRY_BY_CODE.get(activeCountry) : undefined;
  const urbanAreaCount = activeCities.filter((city) => city.geometry.type !== 'Point').length;
  const mapClassName = ['signal-map', className].filter(Boolean).join(' ');

  const updateOverlay = useCallback(
    (frame: GlobeFrame) => {
      const label = countryLabelRef.current;
      if (label) {
        if (frame.countryLabel) {
          label.setAttribute(
            'transform',
            `translate(${frame.countryLabel[0]} ${frame.countryLabel[1]})`,
          );
          label.style.display = '';
        } else {
          label.style.display = 'none';
        }
      }
      for (const marker of validMarkers) {
        const element = markerElementsRef.current.get(marker.id);
        if (!element) continue;
        const position = frame.markerPositions.get(marker.id);
        element.style.display = position ? '' : 'none';
        if (position) element.setAttribute('transform', `translate(${position[0]} ${position[1]})`);
      }
    },
    [validMarkers],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = drawGlobe(
      canvas,
      viewRef.current,
      activeCountry,
      validMarkers,
      highlightedCityIds,
      interactiveRef.current,
    );
    updateOverlay(frame);
  }, [activeCountry, highlightedCityIds, updateOverlay, validMarkers]);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const drawNow = useCallback(() => {
    if (drawFrameRef.current !== null) {
      cancelFrame(drawFrameRef.current);
      drawFrameRef.current = null;
    }
    drawRef.current();
  }, []);

  const scheduleDraw = useCallback(() => {
    if (drawFrameRef.current !== null) return;
    drawFrameRef.current = requestFrame(() => {
      drawFrameRef.current = null;
      drawRef.current();
    });
  }, []);

  const beginInteraction = useCallback(() => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
    interactiveRef.current = true;
  }, []);

  const showDetailedView = useCallback(() => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
    const shouldDraw = interactiveRef.current;
    interactiveRef.current = false;
    if (shouldDraw) drawNow();
  }, [drawNow]);

  const scheduleDetailedView = useCallback(
    (delay = 120) => {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null;
        interactiveRef.current = false;
        drawNow();
      }, delay);
    },
    [drawNow],
  );

  const cancelViewAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) cancelFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const animateViewTo = useCallback(
    (target: GlobeView, duration = 900) => {
      cancelViewAnimation();
      beginInteraction();
      const start = { ...viewRef.current };
      const end = {
        longitude: normalizeLongitude(target.longitude),
        latitude: clampLatitude(target.latitude),
        zoom: clampZoom(target.zoom),
      };
      if (reducedMotionRequested()) {
        viewRef.current = end;
        showDetailedView();
        return;
      }

      const interpolate = geoInterpolate(
        [start.longitude, start.latitude],
        [end.longitude, end.latitude],
      );
      const travel = geoDistance([start.longitude, start.latitude], [end.longitude, end.latitude]);
      const arc = Math.min(0.16, travel * 0.055);
      const startTime = performance.now();
      const animate = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        const coordinate = interpolate(eased);
        const baseZoom = Math.exp(
          Math.log(start.zoom) + (Math.log(end.zoom) - Math.log(start.zoom)) * eased,
        );
        viewRef.current = {
          longitude: normalizeLongitude(coordinate[0]),
          latitude: clampLatitude(coordinate[1]),
          zoom: clampZoom(baseZoom * (1 - arc * Math.sin(Math.PI * progress))),
        };
        if (progress < 1) {
          drawNow();
          animationFrameRef.current = requestFrame(animate);
        } else {
          viewRef.current = end;
          animationFrameRef.current = null;
          scheduleDetailedView(40);
        }
      };
      animationFrameRef.current = requestFrame(animate);
    },
    [beginInteraction, cancelViewAnimation, drawNow, scheduleDetailedView, showDetailedView],
  );

  const animateToCountry = useCallback(
    (code: string) => {
      const country = COUNTRY_BY_CODE.get(code);
      if (!country) return;
      animateViewTo(getCountryView(country), 920);
    },
    [animateViewTo],
  );

  const resetGlobe = useCallback(() => {
    animateViewTo(INITIAL_VIEW, 1000);
  }, [animateViewTo]);

  const selectCountry = useCallback(
    (country: string | null) => {
      if (!isControlled) setInternalSelection(country);
      onCountrySelect?.(country);
    },
    [isControlled, onCountrySelect],
  );

  const activateCountry = useCallback(
    (code: string) => {
      handledSelectionRef.current = code;
      selectCountry(code);
      animateToCountry(code);
    },
    [animateToCountry, selectCountry],
  );

  const clearSelection = useCallback(() => {
    handledSelectionRef.current = null;
    selectCountry(null);
    resetGlobe();
  }, [resetGlobe, selectCountry]);

  // Controlled selections changed elsewhere in the app receive the same transition.
  useEffect(() => {
    if (previousCountryRef.current === activeCountry) return;
    previousCountryRef.current = activeCountry;
    if (
      handledSelectionRef.current !== undefined &&
      handledSelectionRef.current === activeCountry
    ) {
      handledSelectionRef.current = undefined;
      return;
    }
    if (activeCountry) animateToCountry(activeCountry);
    else resetGlobe();
  }, [activeCountry, animateToCountry, resetGlobe]);

  useEffect(() => {
    scheduleDraw();
  }, [activeCountry, highlightedCityIds, scheduleDraw, validMarkers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round((bounds.width || MAP_WIDTH) * ratio));
      const height = Math.max(1, Math.round((bounds.height || MAP_HEIGHT) * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      scheduleDraw();
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [scheduleDraw]);

  useEffect(
    () => () => {
      if (drawFrameRef.current !== null) cancelFrame(drawFrameRef.current);
      if (animationFrameRef.current !== null) cancelFrame(animationFrameRef.current);
      if (wheelFrameRef.current !== null) cancelFrame(wheelFrameRef.current);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    },
    [],
  );

  const zoomAt = useCallback(
    (factor: number) => {
      const current = viewRef.current;
      animateViewTo({ ...current, zoom: clampZoom(current.zoom * factor) }, 240);
    },
    [animateViewTo],
  );

  const startPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      cancelViewAnimation();
      const bounds = event.currentTarget.getBoundingClientRect();
      dragStartRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        longitude: viewRef.current.longitude,
        latitude: viewRef.current.latitude,
        zoom: viewRef.current.zoom,
        unitsPerPixel:
          bounds.width > 0 && bounds.height > 0
            ? 1 / getMapViewport(bounds.width, bounds.height).scale
            : 1,
      };
      didDragRef.current = false;
    },
    [cancelViewAnimation],
  );

  const movePan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - start.clientX;
      const deltaY = event.clientY - start.clientY;
      if (!didDragRef.current && Math.hypot(deltaX, deltaY) > 4) {
        didDragRef.current = true;
        beginInteraction();
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      if (!didDragRef.current) return;
      const degreesPerPixel = (90 / (GLOBE_RADIUS * start.zoom)) * start.unitsPerPixel;
      viewRef.current = {
        longitude: normalizeLongitude(start.longitude - deltaX * degreesPerPixel),
        latitude: clampLatitude(start.latitude + deltaY * degreesPerPixel),
        zoom: start.zoom,
      };
      scheduleDraw();
    },
    [beginInteraction, scheduleDraw],
  );

  const endPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      if (didDragRef.current) {
        const deltaX = event.clientX - start.clientX;
        const deltaY = event.clientY - start.clientY;
        const degreesPerPixel = (90 / (GLOBE_RADIUS * start.zoom)) * start.unitsPerPixel;
        viewRef.current = {
          longitude: normalizeLongitude(start.longitude - deltaX * degreesPerPixel),
          latitude: clampLatitude(start.latitude + deltaY * degreesPerPixel),
          zoom: start.zoom,
        };
      }
      dragStartRef.current = null;
      if (interactiveRef.current) {
        scheduleDraw();
        scheduleDetailedView(60);
      }
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (didDragRef.current) {
        window.setTimeout(() => {
          didDragRef.current = false;
        }, 0);
      }
    },
    [scheduleDetailedView, scheduleDraw],
  );

  const handleMapClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (didDragRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const viewport = getMapViewport(bounds.width, bounds.height);
      const point: [number, number] = [
        (event.clientX - bounds.left - viewport.offsetX) / viewport.scale,
        (event.clientY - bounds.top - viewport.offsetY) / viewport.scale,
      ];
      const country = findCountryAtPoint(point, viewRef.current);
      if (country && isCountryCode(country.code)) activateCountry(country.code);
    },
    [activateCountry],
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      cancelViewAnimation();
      beginInteraction();
      accumulatedWheelDeltaRef.current += event.deltaY;
      if (wheelFrameRef.current !== null) return;
      wheelFrameRef.current = requestFrame(() => {
        const delta = accumulatedWheelDeltaRef.current;
        accumulatedWheelDeltaRef.current = 0;
        wheelFrameRef.current = null;
        viewRef.current = {
          ...viewRef.current,
          zoom: clampZoom(viewRef.current.zoom * Math.exp(-delta * 0.0012)),
        };
        drawNow();
        scheduleDetailedView();
      });
    },
    [beginInteraction, cancelViewAnimation, drawNow, scheduleDetailedView],
  );

  const handleMapKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        clearSelection();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomAt(1.2);
      } else if (event.key === '-') {
        event.preventDefault();
        zoomAt(1 / 1.2);
      } else if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        cancelViewAnimation();
        beginInteraction();
        const current = viewRef.current;
        viewRef.current = {
          ...current,
          longitude:
            event.key === 'ArrowLeft'
              ? normalizeLongitude(current.longitude - 10)
              : event.key === 'ArrowRight'
                ? normalizeLongitude(current.longitude + 10)
                : current.longitude,
          latitude:
            event.key === 'ArrowUp'
              ? clampLatitude(current.latitude + 10)
              : event.key === 'ArrowDown'
                ? clampLatitude(current.latitude - 10)
                : current.latitude,
        };
        scheduleDraw();
        scheduleDetailedView();
      }
    },
    [
      beginInteraction,
      cancelViewAnimation,
      clearSelection,
      scheduleDetailedView,
      scheduleDraw,
      zoomAt,
    ],
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
            {SELECTABLE_COUNTRIES.length} COUNTRY &amp; TERRITORY BOUNDARIES
          </span>
          <button
            className="signal-map__clear"
            type="button"
            onClick={clearSelection}
            disabled={activeCountry === null}
          >
            Clear selection <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      <div className="signal-map__stage">
        <div className="signal-map__stage-meta" aria-hidden="true">
          <span>ORTHOGRAPHIC / WGS84</span>
          <span>{currentCountry?.name ?? 'WORLD / COUNTRY BOUNDARIES'}</span>
        </div>
        <select
          className="signal-map__country-select signal-map__map-country-select"
          aria-label="Select any country"
          value={activeCountry ?? ''}
          onChange={(event) => {
            if (event.target.value) activateCountry(event.target.value);
            else clearSelection();
          }}
        >
          <option value="">Choose a country…</option>
          {SELECTABLE_COUNTRIES.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <div
          className="signal-map__interaction"
          role="region"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onWheel={handleWheel}
          onClick={handleMapClick}
          onKeyDown={handleMapKeyDown}
          data-testid="mena-map"
        >
          <canvas
            ref={canvasRef}
            className="signal-map__canvas"
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            aria-hidden="true"
            data-testid="globe-canvas"
            data-city-count={activeCities.length}
            data-urban-area-count={urbanAreaCount}
          />
          <svg className="signal-map__overlay" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
            {currentCountry && (
              <g data-testid="country-label-layer" aria-hidden="true">
                <text
                  ref={countryLabelRef}
                  className="signal-map__selected-country-label"
                  textAnchor="middle"
                >
                  {currentCountry.name}
                </text>
              </g>
            )}
            <g data-testid="marker-layer">
              {validMarkers.map((marker) => {
                const initialPosition = INITIAL_PROJECTION([marker.longitude, marker.latitude]);
                return (
                  <g
                    key={marker.id}
                    ref={(element) => {
                      if (element) markerElementsRef.current.set(marker.id, element);
                      else markerElementsRef.current.delete(marker.id);
                    }}
                    className="signal-map__marker"
                    transform={
                      initialPosition
                        ? `translate(${initialPosition[0]} ${initialPosition[1]})`
                        : undefined
                    }
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
                    onClick={(event) => {
                      event.stopPropagation();
                      if (didDragRef.current || !onMarkerSelect) return;
                      onMarkerSelect(marker);
                    }}
                    onKeyDown={(event) => {
                      if (onMarkerSelect && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        event.stopPropagation();
                        onMarkerSelect(marker);
                      }
                    }}
                  >
                    <circle r="12" className="signal-map__marker-halo" />
                    <circle r="3.5" className="signal-map__marker-dot" />
                    <title>
                      {marker.label} · {formatCoordinate(marker.latitude, 'latitude')},{' '}
                      {formatCoordinate(marker.longitude, 'longitude')}
                      {marker.detail ? ' · ' + marker.detail : ''}
                    </title>
                  </g>
                );
              })}
            </g>
            <text x="28" y="34" className="signal-map__corner-label" aria-hidden="true">
              WORLD / NATURAL EARTH
            </text>
            <text
              x="972"
              y="34"
              textAnchor="end"
              className="signal-map__corner-label"
              aria-hidden="true"
            >
              DRAG TO ROTATE
            </text>
            <text x="28" y="617" className="signal-map__coordinate-label" aria-hidden="true">
              GLOBAL / 50M + 10M DETAIL
            </text>
            <text
              x="972"
              y="617"
              textAnchor="end"
              className="signal-map__coordinate-label"
              aria-hidden="true"
            >
              {activeCountry ? `${urbanAreaCount} URBAN FOOTPRINTS` : 'GLOBAL COUNTRY COVERAGE'}
            </text>
          </svg>
        </div>

        <div className="signal-map__zoom-controls" aria-label="Globe navigation controls">
          <button type="button" onClick={() => zoomAt(1.2)} aria-label="Zoom in">
            <ZoomIn size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => zoomAt(1 / 1.2)} aria-label="Zoom out">
            <ZoomOut size={18} aria-hidden="true" />
          </button>
          <span aria-hidden="true" />
          <button type="button" onClick={resetGlobe} aria-label="Animate reset globe view">
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
            {currentCountry?.name ?? activeCountry ?? 'No country selected'}
          </span>
          {activeCountry && (
            <span className="signal-map__selection-detail">
              {urbanAreaCount} urban footprints · {activeCities.length - urbanAreaCount} reference
              places
            </span>
          )}
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
              onClick={() => activateCountry(code)}
            >
              <span>{name}</span>
              <span className="signal-map__country-option-code">{code}</span>
            </button>
          ))}
        </div>
      </div>

      <footer className="signal-map__footer">
        <span>
          <i aria-hidden="true" /> NATURAL EARTH / COUNTRIES + URBAN FOOTPRINTS
        </span>
        <span>HIGH-DETAIL GEOGRAPHIC DATA BUNDLED OFFLINE</span>
      </footer>
    </section>
  );
}
