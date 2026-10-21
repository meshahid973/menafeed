# Geographic data attribution

- **Global country and territorial-unit polygons:** [nvkelso/natural-earth-vector — ne_110m_admin_0_countries.geojson](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson). Natural Earth data is public domain; 1:110m geometry is generalized for global-scale context.
- **Tiny-area location markers:** [nvkelso/natural-earth-vector — ne_50m_admin_0_tiny_countries.geojson](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_tiny_countries.geojson). These point features provide locators for small map units whose full borders are not distinguishable at world scale; they are not border geometry.
- **MENA regional geometry and context:** [datasets/geo-boundaries-world-110m](https://github.com/datasets/geo-boundaries-world-110m), Natural Earth-derived data; repository metadata records ODC-PDDL-1.0 and identifies the underlying Natural Earth data as public domain.
- **Bahrain island supplement:** [eFrane/admin0](https://github.com/eFrane/admin0), release line 4.0.1; repository package metadata declares CC0-1.0 and its README identifies Natural Earth v3.1 as the source.

The bundled GeoJSON keeps only the country name, display code, editorial-selectability flag, source resolution and geometry. The selection list is maintained separately in coverage.ts, because editorial MENA coverage is not identical to a universally agreed geographic or political definition.
