# SIGNAL design system

## Identity

The map should read like a precise intelligence terminal; editorial news content should remain comfortably readable. Restrained technical details support journalism rather than competing with it.

Global CSS is restricted to `src/app/styles/tokens.css` and `global.css`. Component selectors are owned by each component or feature, prefixed by their component name (e.g. `.signal-shell__header`). Do not layer copied CSS frameworks, use broad selectors in feature styles, or append override blocks for one-off fixes.

### Tokens

| Category | Values |
| --- | --- |
| Background | `--signal-bg: #090b0c` |
| Surface | `--signal-surface: #14191b` |
| Text | `--signal-text: #e6e6df` |
| Muted text | `--signal-text-muted: #95a39e` |
| Accent | `--signal-accent: #d4fd73` |
| Borders | `--signal-border: #303a38` |
| Metadata | `--signal-font-mono` |
| Headlines | `--signal-font-editorial` |
| Spacing | 4, 8, 12, 16, 24, 32, 48px |
| Motion | 120/220/420ms, standard ease |

System fallback fonts ship without an external network request. Before bundling font binaries in a future release, verify their licenses and keep notice files; do not rely on CDN availability during the competition demonstration.

### Motion conventions

CSS handles tiny transitions. If complex gesture / layout choreography is needed later, adopt a *single* Motion for React dependency, with CSS tokens and `prefers-reduced-motion` behavior kept consistent. Animating map geometry should avoid expensive React state updates each frame. No motion library is installed in Phase 1 because it has no consumer.

### Component sourcing

These are candidate *sources*, not installed dependencies:

- **Bencho.dev:** MIT-licensed library according to the public license, but still verify the specific component's dependencies and attribution.
- **21st.dev:** a registry of independent contributors; verify each component's actual license rather than assuming one blanket license.
- **BEUI:** distinguish free/public components from Pro's separate paid license.
- **React Bits:** public project uses MIT with Commons Clause restrictions; review the exact license before reusing source.
- **Motion for React:** reserve it for real layout/gesture requirements; assess its release and license when adopted.

Do not install complete design frameworks for isolated components. Any adopted component becomes SIGNAL-owned code reviewed for accessibility, CSS collisions, security, and third-party license compliance.

### Accessibility

Keep visible focus rings, meaningful heading structure, sufficient text contrast, reduced-motion support, and non-hover ways to navigate. Future map dots and selected countries need keyboard-operable equivalents in the synchronized list view.
