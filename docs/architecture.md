# Architecture

## Phase 1 boundaries

```text
src/app/                 application entry and global tokens
src/components/layout/   shared page shell and its owned CSS
src/features/desktop/    desktop readiness UI state
src/features/news/       future news domain contracts (no provider implementation)
src/services/            typed frontend/native boundary
src/test/                shared browser test setup
src-tauri/src/commands/  narrowly scoped public native commands
src-tauri/src/database/  SQLite initialization and versioned migrations
src-tauri/src/models/    serialized Rust command responses
src-tauri/migrations/    schema changes
```

Only directories with implementation files exist; do not create all future feature folders in advance.

## Dependency direction

`app -> features/components -> services -> Tauri invoke -> Rust commands -> backend services/database`.

Feature UI never imports another feature's private components or reaches directly into the filesystem. Shared types belong in the owning feature until two independent features need the same stable contract. Native access is routed through explicit service functions; there is no generic 'run arbitrary SQL' command.

The current `get_app_status` command reports the initialized database schema version after Rust startup has run its migration. In a browser, the service returns a preview state without invoking a nonexistent desktop backend. Error messages are intentionally generic at the presentation boundary.

## Data contracts (future ingestion)

`src/features/news/contracts.ts` defines articles, sources, and discriminated geographic location precision: unknown, country, and city. City-level events require coordinates plus resolution evidence. These definitions are not validation, and do not prove that geographic claims are true.

Future flow:

```text
Provider adapters (GDELT, RSS)
  -> runtime input validation / safe URL rules
  -> canonical news records and deduplication
  -> geographic resolution with evidence + explicit uncertainty
  -> Rust persistence and indexed cache
  -> presentation queries and map views
```

Do not turn provider article text into HTML. Escape text through React, verify external URLs, and never build SQL directly from untrusted input. Keep remote network origins and Tauri permissions narrow as providers are introduced.

## Persistence

Rust opens `signal.sqlite3` in the application-local-data directory, enabling foreign keys and SQLite WAL mode. Migration `0001_initialize.sql` establishes only cache and bookmark tables. `PRAGMA user_version` prevents rerunning already applied migrations and refuses databases created by a newer app. Future schema revisions should increment the version and test a real upgrade path.

## Architecture decisions

- **React + Tauri:** React owns view state; Rust owns privileged operations and offline storage.
- **SQLite through Rust:** minimizes exposed native permissions compared to an unrestricted SQL plugin.
- **No routing library yet:** there is only one desktop screen.
- **No state-management library yet:** local React state is sufficient for one native-status handshake.
- **D3 Geo vs MapLibre deferred:** phase 2 should benchmark D3/SVG for region-level paths and MapLibre for city-level pan/zoom; use only one primary map renderer.
- **No live ingestion yet:** avoid prematurely locking in provider quotas, API keys, parsing behavior, or location semantics.
