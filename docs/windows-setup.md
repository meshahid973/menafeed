# Windows 11 setup and commands

Open **PowerShell**. Install the prerequisites below first. Restart PowerShell after installing tools so their PATH entries load.

## 1. Prerequisites

```powershell
winget install --id Git.Git --exact
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id Rustlang.Rustup --exact
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact
```

Open **Visual Studio Installer** and modify Build Tools to include **Desktop development with C++**, MSVC build tools, and the Windows 10/11 SDK. This is required for native Rust/Tauri Windows linking; just installing the Build Tools launcher is insufficient.

Install the **Microsoft Edge WebView2 Runtime** if it is not already installed (it is normally present on Windows 11): https://developer.microsoft.com/microsoft-edge/webview2/

Set Rust's MSVC toolchain and check the installed versions:

```powershell
rustup default stable-x86_64-pc-windows-msvc
rustup component add rustfmt clippy
git --version
node --version
npm --version
rustc --version
cargo --version
```

Node.js must be at least 22.12.0. Tauri needs a supported Rust stable MSVC toolchain and WebView2.

## 2. Clone and install

```powershell
git clone https://github.com/meshahid973/menafeed.git
cd menafeed
npm ci
```

Lockfiles are committed. Use `npm ci` for reproducible clean installs, and never check in `node_modules`.

## 3. Development

```powershell
npm run dev
```

This starts a browser preview at `http://127.0.0.1:1420` (no native database).

In a new PowerShell session (stop the browser server with Ctrl+C first if it occupies port 1420):

```powershell
npm run dev:desktop
```

This starts Vite and launches the Tauri window. Native SQLite is initialized in the app-local-data directory before the status handshake.

## 4. Quality checks

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build:web
npm run check

cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

## 5. Build the Windows installer

```powershell
npm run build:desktop
Get-ChildItem .\src-tauri\target\release\bundle\nsis\*.exe
Get-Item .\src-tauri\target\release\signal-mena.exe
```

The NSIS installer is under `src-tauri/target/release/bundle/nsis/`. The unpackaged Windows binary is `src-tauri/target/release/signal-mena.exe`. A build is not proof of a successful installation: launch the installer, start the installed application, and confirm the database-ready indicator on your Windows machine.

## Troubleshooting

- **`link.exe` not found:** install the C++ workload/SDK and restart the terminal.
- **`cargo` / `rustc` not found:** install rustup; verify `$env:USERPROFILE\.cargo\bin` is on PATH.
- **Port 1420 occupied:** close a previous Vite/Tauri process instead of changing the port (Tauri's devUrl is fixed).
- **WebView2 missing:** install the Evergreen WebView2 Runtime.
- **First desktop build feels slow:** Rust dependencies compile for the first time; subsequent builds use Cargo caches.
