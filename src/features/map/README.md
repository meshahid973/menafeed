# SIGNAL geographic feature

A self-contained, offline-first **orthographic world globe** built with D3 Geo, Canvas and a small SVG overlay for accessible news markers and the selected-country label. All geographic data is bundled locally; there are no map-tile requests or permanently running animation loops.

## Rendering and performance

Country and city geometry is projected directly into a canvas. Drag, wheel and animation updates are coalesced with `requestAnimationFrame`; they update refs and pixels without re-rendering the React component tree or replacing hundreds of SVG paths on every frame. Canvas resolution follows container size and device pixel ratio (capped at 2), and off-screen countries are excluded using geographic bounds.

The globe uses adaptive level of detail: 1:110m global context and 1:50m selected-country geometry during motion, then 1:50m global context and the selected country's more accurate 1:10m shape when interaction settles. Detail restoration uses a short cancellable timer so another drag is never blocked by an unnecessary redraw. Compact TopoJSON keeps the higher-resolution offline data practical. Geographic hit-testing still uses the detailed country shapes, so canvas selection and drawing stay aligned.

## Globe interaction

Drag to rotate, scroll or use the controls to zoom, and select a country through its shape or the accessible country selector. Only the **selected country's name** is drawn on the globe; there is no world-wide country-label layer.

Country clicks, MENA shortcuts, controlled selection changes and clearing a selection all use eased geographic interpolation. The target zoom is fitted from the country's projected bounds, so Bahrain receives a closer view than Saudi Arabia. Reset uses the same smooth interpolation back to the default MENA-centered view. Zoom controls also animate, while direct manipulation remains immediate. Reduced-motion preferences skip animation.

## Cities and news areas

The selected country displays Natural Earth 1:10m **urban footprints** with real polygon outlines, plus labels for capitals and major places. Urban footprints describe built-up extents, not administrative city limits. Places without a matching source polygon remain reference points rather than invented boundaries.

News markers can include `countryCode` and `cityName` in addition to coordinates. When a selected country's story matches a city alias, its urban footprint is highlighted. If no name matches, coordinates inside an urban polygon provide a spatial fallback. Highlights are limited to the active country and never infer a location from an ordinary country-name headline mention.

## World news and country filtering

The RSS feed pipeline includes international and regional publishers. On selecting a country, articles with explicit publisher-supplied locations use that metadata. Other RSS articles can be matched against configured country names and aliases in headlines/summaries, since standard RSS often does not provide verified event coordinates. A text mention does not create a news marker or imply a verified event location.

## Public API

`MenaGlobe` exposes controlled or internal country selection, coordinate-backed news markers, and marker activation callbacks. Country selection uses a two-letter code where the geographic dataset provides one, or null when selection is cleared. Invalid markers and markers on the globe's far hemisphere are omitted. `MenaMarker.countryCode` and `MenaMarker.cityName` are optional hints for urban-area highlighting; coordinates remain required.

`MenaGlobeDemo` remains a standalone fixture. Its Manama marker is labelled as example data and is not a news event.

## Geographic data and licensing

See [data/ATTRIBUTION.md](data/ATTRIBUTION.md) for the exact Natural Earth source files and revision. Natural Earth data is public domain. Boundaries and urban extents are generalized and contested areas can differ by source. They provide geographic context, not legal, administrative, or surveying reference.

## Quality checks

Run `npm ci` followed by `npm run check` from the project root. The check script runs typecheck, lint, formatting, tests and the web build. Tauri/Rust code should also be validated by the Windows CI job.
