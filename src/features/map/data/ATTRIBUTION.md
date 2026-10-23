# Geographic data attribution

- **Global country boundaries:** [nvkelso/natural-earth-vector — ne_110m_admin_0_countries.geojson](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson). Natural Earth data is public domain; 1:110m geometry is generalized for global-scale context.
- **Major city coordinates:** [nvkelso/natural-earth-vector — ne_110m_populated_places.geojson](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_populated_places.geojson). A subset of major populated places is bundled as points for city labels at closer zoom.
- **MENA regional geometry:** [datasets/geo-boundaries-world-110m](https://github.com/datasets/geo-boundaries-world-110m), Natural Earth-derived data; repository metadata records ODC-PDDL-1.0 and identifies the underlying Natural Earth data as public domain.
- **Bahrain island supplement:** [eFrane/admin0](https://github.com/eFrane/admin0), release line 4.0.1; repository package metadata declares CC0-1.0 and its README identifies Natural Earth v3.1 as the source.

The bundled country GeoJSON keeps the country name, display code, editorial-selectability flag, source resolution and geometry. The MENA picker remains separate because regional editorial coverage is not identical to a universally agreed geographic or political definition.
