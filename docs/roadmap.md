# Scope and roadmap

## Phase 1 — Foundation (current)

React and Tauri bootstrap, typed desktop status boundary, Rust-owned SQLite schema v1, tokens, minimal shell, unit tests, CI, and Windows setup documentation. The UI explicitly identifies browser preview mode. No real news data is displayed.

## Phase 2 — Geographic interface

1. Evaluate D3 Geo/SVG against MapLibre using representative GeoJSON and city-marker counts; document coordinates, data license, memory, FPS, and zoom tradeoffs.
2. Create the MENA coverage manifest with explicit ISO country codes and a policy for countries at disputed boundaries. Distinguish the region's editorial definition from cartographic borders.
3. Implement an accessible regional map, country selection, clear-selection action, zoom, and map/feed hover linking using labelled **sample** articles.
4. Implement a compact editorial feed component and selectable article inspector. Prove keyboard and pointer navigation, reduced-motion behavior, and small-laptop layouts.
5. Add interaction tests and a reliable offline presentation fixture, clearly marked as a demonstration.

Later phases: news provider connectors, runtime schemas and location evidence, deduplication, real sources and timestamps, history playback, bookmarking UI, cross-country search, and installation/QA polish. The design and data model must not misrepresent approximate geocoding as precise event location.
