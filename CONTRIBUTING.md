# Contributing to SIGNAL

## Development flow

1. Branch from `main`, using a concise name such as `feat/map-navigation`.
2. Keep each change focused, with files owned by the relevant feature.
3. Run `npm run check` and the Rust checks listed in the README.
4. Open a pull request with a summary, design tradeoffs, test evidence, and limitations.
5. Merge after relevant checks and review. Avoid force-pushing shared branches.

Use conventional commit subjects (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).

## Module placement

- Feature-specific React components, hooks, and styles live in `src/features/<feature>/`.
- Only genuinely reusable layout or primitives go into `src/components/`.
- React/native transport and external integration adapters go into `src/services/`.
- Rust commands are intentionally narrow. Backend storage belongs in `src-tauri/src/database/`.
- New database changes require an ordered migration and migration test.
- If you introduce a dependency, document why it is necessary and review its license.
- Never create placeholder directories, duplicate model definitions, or a second global stylesheet.

## PR checklist

- [ ] No unrelated files, credentials, generated artifacts, or unnecessary dependencies.
- [ ] New UI respects keyboard focus and reduced-motion preferences.
- [ ] Untrusted inputs are validated at their entry boundary.
- [ ] UI components do not directly read/write database files.
- [ ] Frontend and Rust validation have been run or limitations explained.
- [ ] Changes to geographic precision never imply unsupported certainty.
