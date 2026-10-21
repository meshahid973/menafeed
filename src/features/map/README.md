# SIGNAL geographic feature

A self-contained, offline-first **orthographic world globe** built with D3 Geo and SVG. It renders Natural Earth country and territorial-unit boundaries on a sphere, with a more detailed Bahrain geometry supplement. The default camera is centered on MENA because this application focuses on regional news.

## Globe renderer

The globe uses D3 Geo's orthographic projection and bundled GeoJSON. The circular horizon, radial shading, graticule, and clipped country paths create a spherical view without requiring a WebGL context or a permanently running animation loop. Drag to rotate the sphere, scroll or use the controls to zoom, and use the arrow keys while the globe is focused to rotate the view. The map remains offline after installation.

All country and territorial-unit geometries are present in the bundled world dataset. For product consistency with MenaFeed's current reporting coverage, direct country selection and the country picker remain limited to the 27 editorial MENA entries. Other countries still appear with their Natural Earth boundaries and name on hover. News markers use their actual longitude and latitude and are only drawn on the visible hemisphere.

## Public API

The component continues to expose controlled or internal MENA selection, coordinate-backed markers, and marker activation callbacks. The selection callback receives a two-letter editorial MENA coverage code, or null when cleared. Markers require a stable identifier, label, longitude and latitude. Invalid coordinates are rejected; markers on the globe's far hemisphere are hidden until the globe rotates to face them.

MenaGlobeDemo remains a standalone integration fixture. Its Manama marker is explicitly labelled as demo data and is not a news event.

## Geographic data and licensing

The bundled world dataset uses the Natural Earth 1:110m admin-0 country dataset from [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector). It is simplified for world-scale rendering and its source is public domain. The MENA coverage geometries retain the project’s previously bundled Natural Earth-derived boundary data from [datasets/geo-boundaries-world-110m](https://github.com/datasets/geo-boundaries-world-110m), and Bahrain uses a higher-resolution polygon supplement from [eFrane/admin0](https://github.com/eFrane/admin0), which declares CC0-1.0. See the attribution file in this folder.

The selection manifest contains 27 editorial entries, including Western Sahara, Palestine and Cyprus. Coverage is a product decision, not a declaration of sovereignty. Natural Earth-style cartography is generalized at small scales and represents cartographic administrative lines. Western Sahara, Israel/Palestine, Cyprus, Northern Cyprus, Somaliland and other contested areas may differ by source or scale. These boundaries are for geographic context and news visualization only, not legal, surveying, military, or diplomatic reference.

## Accessibility and interaction

- Drag to rotate; wheel and zoom buttons change scale; reset returns to the default MENA-centered view.
- Keyboard arrows rotate the focused globe, plus and minus zoom, Escape clears selection, and MENA country shapes remain keyboard-operable.
- Country boundaries and geographic data are bundled offline. There are no map tiles, runtime geodata downloads, or continuous animation loop.
- Motion transitions respect prefers-reduced-motion.
- The feature has no dependency on the news feature or app-shell state; it reuses the existing signal design tokens.

## Quality checks

Run the repository checks from the project root: npm ci, npm run typecheck, npm run lint, npm run format:check, npm run test, npm run build:web, and npm run check.

The Tauri/Rust checks are unaffected by this frontend-only change.
