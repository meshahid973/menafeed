# SIGNAL geographic feature

A self-contained, offline-first MENA map built with **D3 Geo + SVG**. It is a regional geographic visualization, not a continuously rotating 3D globe.

## Renderer decision

D3 Geo is used for its geographic projections, GeoJSON-to-SVG path generation, and direct longitude/latitude projection. This is a better fit than COBE's globe-oriented rendering for the current requirements: exact selectable regional country paths, independent keyboard controls, known viewport bounds, and coordinate-true markers. A Three.js globe would introduce WebGL lifecycle and hit-testing complexity without improving country-level precision for a MENA-first view.

No WebGL context, animation loop, map tile requests, or external runtime data requests are needed. SVG paths are generated from a bundled GeoJSON file, the projection is shared, and React state changes only for interactions such as hover, selection, pan, and zoom. Pan gestures adjust the SVG group directly while in progress. If a browser has no WebGL support, the map still works because WebGL is not a dependency.

## Public API

```tsx
import { useState } from 'react';
import { MenaGlobe } from './features/map';
import type { MenaCountryCode, MenaMarker } from './features/map';

const [selectedCountry, setSelectedCountry] = useState<MenaCountryCode | null>(null);

const markers: MenaMarker[] = [
  {
    id: 'demo-manama',
    label: 'Manama · example coordinate',
    longitude: 50.5876,
    latitude: 26.2235,
    detail: 'Example only; not a news event',
  },
];

<MenaGlobe
  selectedCountry={selectedCountry}
  onCountrySelect={setSelectedCountry}
  markers={markers}
  onMarkerSelect={(marker) => console.info(marker.id)}
/>;
```

- Omit `selectedCountry` to use internal selection state; pass a value (including `null`) to control it.
- `onCountrySelect` receives a two-letter ISO-style coverage code, or `null` when cleared.
- Markers require a stable `id`, `label`, longitude and latitude. Out-of-range positions are rejected; positions outside the view are not drawn. Visual positions are projected from geographic coordinates, never assigned manually.
- `MenaGlobeDemo` is a standalone integration fixture. Its Manama marker is explicitly labelled as demo data and is not a news event.

The feature has no dependency on SIGNAL's news feature or app state. It reuses the existing `--signal-*` tokens and owns its stylesheet under `components/`. The current app shell is intentionally unchanged; integration can happen when the primary developer is ready.

## Geographic data and licensing

`data/mena-countries.geojson` is bundled for offline use. Its country/context geometries are exported from [datasets/geo-boundaries-world-110m](https://github.com/datasets/geo-boundaries-world-110m), which records an ODC-PDDL 1.0 / Natural Earth provenance. Bahrain's island polygon is supplemented from [eFrane/admin0](https://github.com/eFrane/admin0), version 4.0.1, which records CC0-1.0 and describes its data as Natural Earth v3.1. Geometry is simplified before committing to keep the frontend asset compact (about 141 KB).

The editorial coverage manifest contains 27 entries, including Western Sahara, Palestine and Cyprus. Coverage is a product decision, not a declaration of sovereignty. Natural Earth-style cartography is generalized at small scales and commonly represents de-facto administrative lines. Western Sahara, Israel/Palestine, Cyprus and other contested areas can differ by cartographic source or zoom level. The boundaries are for context and news visualization only; they are not legal, surveying, military, or diplomatic reference lines. Bahrain uses a higher-resolution supplement because very small Gulf island geometry is lost in generalized country datasets.

## Country focus and newsroom filtering

Selecting a country gently zooms and recentres the existing regional map over 480 ms. The target comes from the country's projected bounds and centre, with a restrained maximum zoom. The map never rotates; it keeps the same projection and simply moves and scales into focus. Switching countries smoothly updates the focus, clearing selection returns to the regional overview, and system reduced-motion preferences bypass the animation.

This feature remains a projected 2D regional map, not a perspective 3D globe. Country focus is a simple zoom-and-pan transition rather than spherical camera movement.

Country-news filtering consumes the article location contract already used by `NewsFeed`. The Rust RSS parser assigns country precision **only** when publisher-provided RSS category metadata exactly identifies one MENA country. It never infers country from title or summary text. Items with no explicit country category or multiple different country categories remain `precision: "unknown"` and are omitted from country-filtered views. Many regional RSS items have no country taxonomy, so country views can legitimately be empty; the UI states that limitation instead of mixing in unrelated stories. No new news API or fabricated location data is introduced.

## Interaction and accessibility

- The region opens centered on North Africa and West Asia with country hover/selection highlighting.
- Drag to pan; wheel and buttons to zoom; the reset button returns to the default view. Keyboard arrows pan, `+`/`-` zoom, and `Escape` clears selection.
- All countries are available through a keyboard-operable selection list, including microstates whose map polygons are too small for reliable pointer targeting.
- Markers are focusable and keyboard-activatable when an `onMarkerSelect` callback is supplied.
- The SVG uses static paths and no permanent animation loop. Motion transitions are removed under `prefers-reduced-motion`.
- The coordinate system uses longitude/latitude coordinates as geographic inputs and D3 Geo to project them into the regional SVG view box.

## Quality checks

Tests are added with Vitest and Testing Library for coverage completeness, boundary geometry, WGS84 range validation, projection, country selection/clearing, controlled selection, and marker interaction. Run the repository commands from the root:

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build:web
npm run check
``

The Tauri/Rust checks in the root README are unaffected by this frontend-only change.
```
