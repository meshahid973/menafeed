# SIGNAL / MENA

Desktop news atlas for the Middle East and North Africa.

Tauri 2 · React · TypeScript · SQLite

**Now:** editorial layout, BBC Middle East and France 24 RSS, source filters, search, offline cache. Map integration slot is reserved.

**Run:**

```powershell
npm ci
npm run dev:desktop
```

**Check:** `npm run check` and `cargo test --locked --manifest-path src-tauri/Cargo.toml`.

**Build:** `npm run build:desktop`.

More: [Windows setup](docs/windows-setup.md) · [Architecture](docs/architecture.md)

RSS is publisher-owned. Locations are unverified; scraping is not enabled.
