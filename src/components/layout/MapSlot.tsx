import './MapSlot.css';

/**
 * Only integration point for the independently developed geographic feature.
 * Replace the content of this component, not the app or editorial feed.
 */
export function MapSlot() {
  return (
    <section className="signal-map-slot" aria-label="Regional map area">
      <div className="signal-map-slot__grid" aria-hidden="true" />
      <div className="signal-map-slot__top">
        <span>
          <span className="signal-map-slot__indicator" /> GEOGRAPHIC VIEW
        </span>
        <span>MENA / 01</span>
      </div>
      <div className="signal-map-slot__center">
        <span className="signal-map-slot__crosshair" aria-hidden="true">
          +
        </span>
        <span className="signal-map-slot__overline">REGIONAL ATLAS</span>
        <h1>
          Stories have
          <br />a place<span>.</span>
        </h1>
        <p>Explore where news unfolds across the region.</p>
        <div className="signal-map-slot__note">MAP MODULE / IN DEVELOPMENT</div>
      </div>
      <div className="signal-map-slot__bottom">
        <span>24° N — 47° E</span>
        <span>GEOGRAPHIC LAYER PENDING</span>
      </div>
    </section>
  );
}
