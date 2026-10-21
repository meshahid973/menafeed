# SIGNAL / MENA

A geographic news intelligence desktop application focused on the Middle East and North Africa.

**Phase 1:** the desktop foundation, not a finished news product. The application currently renders a minimal SIGNAL shell and reports whether the Rust backend and local SQLite database initialized successfully. The news map, real feeds, and timeline are planned for subsequent milestones.

## Stack

- Tauri 2 and Rust for the Windows-native application boundary
- React 19, TypeScript, and Vite 8 for the desktop view
- SQLite (via Rust/rusqlite) for future offline caches and bookmarks
- Vitest, Testing Library, ESLint, Prettier, and Rust checks for quality

## Quick start (Windows 11 / PowerShell)

Install Node.js 22+, Rust stable MSVC, Microsoft C++ Build Tools (Desktop development with C++ and Windows SDK), and WebView2 first. Full instructions: [docs/windows-setup.md](docs/windows-setup.md).

```powershell
git clone https://github.com/meshahid973/menafeed.git
cd menafeed
npm ci
npm run dev:desktop
```

For a browser-only preview, run `npm run dev`. The browser preview deliberately does not initialize SQLite; the native window does.

## Verify and package

```powershell
npm run check
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:desktop
```

The NSIS installer appears at `src-tauri/target/release/bundle/nsis/` when built on Windows.

## Project conventions

- [Architecture and module ownership](docs/architecture.md)
- [Design system and component sourcing](docs/design-system.md)
- [Windows prerequisites, commands, and build outputs](docs/windows-setup.md)
- [Development and contribution process](CONTRIBUTING.md)
- [Phase 2 proposal](docs/roadmap.md)

**Security:** Native file/database operations happen in Rust. Web content and future news API payloads are untrusted. Do not add broad Tauri permissions or expose arbitrary SQL through frontend commands.
