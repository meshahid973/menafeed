# Geographic data attribution

- **Global country and territorial-unit geometries:** [nvkelso/natural-earth-vector — ne_110m_admin_0_countries.geojson](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson). Natural Earth data is public domain; the 1:110m generalized resolution is intended for global-scale context.
- **MENA regional geometry and context:** [datasets/geo-boundaries-world-110m](https://github.com/datasets/geo-boundaries-world-110m), Natural Earth-derived data; repository metadata records ODC-PDDL-1.0 and identifies the underlying Natural Earth data as public domain.
- **Bahrain island supplement:** [eFrane/admin0](https://github.com/eFrane/admin0), release line 4.0.1; repository package metadata declares CC0-1.0 and its README identifies Natural Earth v3.1 as the source.

The bundled GeoJSON keeps only the country name, display code, editorial-selectability flag, source resolution and geometry. The selection list is maintained separately in coverage.ts, because editorial MENA coverage is not identical to a universally agreed geographic or political definition.
