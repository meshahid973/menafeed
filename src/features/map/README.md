# SIGNAL geographic feature

A self-contained, offline-first **orthographic world globe** built with D3 Geo and SVG. Global country boundaries are bundled locally using Natural Earth geometry, with the existing higher-detail MENA geometry preserved, including Bahrain.

## Globe interaction

The circular horizon, radial shading and graticule create a spherical view without a WebGL dependency or a permanently running animation loop. Drag to rotate, scroll or use the controls to zoom without an arbitrary upper zoom ceiling. Reset animates a full spin and an eased zoom back to the default MENA-centered view. Keyboard arrows rotate the focused globe; plus and minus zoom.

Country polygons are selectable across the world, not just inside the MENA region. The existing MENA country picker remains as a shortcut list. Tiny-country locator dots have been removed from the boundary layer; when a country's outline is too small to see at world scale, zoom in to inspect the available map geometry.

## Cities and geographic context

Major populated places from Natural Earth's ne_110m_populated_places dataset are bundled offline. City points appear as the globe is zoomed in; country capitals and larger cities receive labels at closer zoom levels. City coordinates are reference locations, not proof that a news event took place there.

## World news and country filtering

The RSS feed pipeline includes BBC World, The Guardian World, NPR World, Al Jazeera English, UN News and Deutsche Welle's world feed, alongside existing regional publishers. On selecting a country, articles with an explicit publisher-supplied location use that metadata. Other RSS articles are matched against country names and configured aliases in headlines/summaries, since standard RSS often does not provide verified event coordinates. A text mention does not create a news marker or imply a verified event location.

## Public API

The component exposes controlled or internal country selection, coordinate-backed news markers, and marker activation callbacks. Country selection uses a two-letter code where the geographic dataset provides one, or null when selection is cleared. News markers require a stable identifier, label, longitude and latitude; invalid coordinates and markers on the globe's far hemisphere are omitted.

MenaGlobeDemo remains a standalone fixture. Its Manama marker is labelled as example data and is not a news event.

## Geographic data and licensing

- **Country polygons:** [nvkelso/natural-earth-vector — ne_110m_admin_0_countries.geojson](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson). Natural Earth data is public domain and generalized for global-scale use.
- **City coordinates:** [nvkelso/natural-earth-vector — ne_110m_populated_places.geojson](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_populated_places.geojson), reduced to major populated places for a compact offline city layer.
- **MENA regional geometry:** [datasets/geo-boundaries-world-110m](https://github.com/datasets/geo-boundaries-world-110m), Natural Earth-derived data. Bahrain retains a higher-resolution island supplement from [eFrane/admin0](https://github.com/eFrane/admin0), which declares CC0-1.0.

The MENA picker is an editorial coverage shortcut, not a declaration of sovereignty. Natural Earth boundaries are generalized and contested areas can differ by source or scale. These boundaries are for geographic context and news visualization, not legal or surveying reference.

## Quality checks

Run npm ci followed by npm run check from the project root. The check script runs typecheck, lint, format, tests and the web build. Tauri/Rust code should also be validated by the Windows CI job.
