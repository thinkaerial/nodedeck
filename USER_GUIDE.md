# NodeDeck User Guide

This guide walks through getting NodeDeck installed and running, and how to use each part of it. No prior experience with the project assumed.

## What NodeDeck is for

If you have one or more Raspberry Pi (or similar) "companion computers" — small Linux boards riding on a drone or robot, running your flight/vision/telemetry software over SSH — NodeDeck gives you one app to find them on your network, connect to them, move files, watch their vitals, tail their logs, and run the same operation across all of them at once.

Everything runs locally on your machine. There's no cloud account, no server, no sync — NodeDeck talks directly to your devices over SSH/SFTP on your local network.

## Installing

### Option A — download a release (easiest, no build tools needed)

Go to [Releases](https://github.com/thinkaerial/nodedeck/releases/latest) and grab the installer for your platform:
- **macOS (Apple Silicon)**: the `.dmg`
- **Windows (x64)**: the `.exe` or `.msi`

The app isn't code-signed yet (see [Status](README.md#status)), so:
- **macOS** will refuse to open it the first time with "cannot be opened because the developer cannot be verified." Right-click (or Control-click) the app → **Open** → confirm. You only need to do this once.
- **Windows** SmartScreen may show "Windows protected your PC." Click **More info** → **Run anyway**.

There's no Intel-Mac or Linux build published yet — if you're on either, use Option B below.

### Option B — build from source (all platforms, incl. Intel Mac / Linux)

You'll need:
- [Node.js](https://nodejs.org/) 20 or newer
- [Rust](https://rustup.rs/) (stable toolchain)
- The platform build tools Tauri needs — follow [Tauri's prerequisites guide](https://tauri.app/start/prerequisites/) for your OS (on macOS this is just Xcode Command Line Tools; on Windows it's the Visual Studio Build Tools with the "Desktop development with C++" workload; on Linux a handful of system packages)

Then:

```bash
git clone https://github.com/thinkaerial/nodedeck.git
cd nodedeck
npm install
npm run tauri build
```

The build takes a few minutes. When it finishes:
- **macOS**: your app is at `src-tauri/target/release/bundle/macos/nodedeck.app`, and a `.dmg` installer next to it in `src-tauri/target/release/bundle/dmg/`. Drag the `.app` into `/Applications`, or open the `.dmg` and drag it from there.
- **Windows**: an `.msi` and/or `.exe` installer under `src-tauri\target\release\bundle\`. Run it like any other installer.
- **Linux**: an `.AppImage` and/or `.deb`/`.rpm` under `src-tauri/target/release/bundle/`, depending on your distro's packaging tools.

Same Gatekeeper/SmartScreen notes as Option A apply.

## First launch

The first time you open NodeDeck, you'll land on a **create account** screen. Pick any username and a password (min 8 characters) — this account is entirely local to this install of the app; nothing is sent anywhere. NodeDeck supports multiple accounts on the same machine, each with its own fully separate set of devices, tasks, and history — useful if more than one person shares the same computer, or you want a clean sandbox to try things in.

After that you'll land on the **Dashboard** — empty at first, since you haven't added any devices yet.

## Adding a device

You have two ways in:

1. **Network Scanner** (left sidebar) — enter your LAN's CIDR range (it auto-fills a guess based on your current network) and click **Scan LAN**. NodeDeck probes every address in range and shows the ones that are genuinely reachable — devices with SSH open are the ones you can add and manage; everything else (phones, laptops, routers) shows up too but greyed out as "no SSH." Click **Save & connect** on the device you want.
2. **Devices → Add device** — if you already know the IP/hostname, username, and password (or SSH key) for a device, add it directly without scanning.

Either way, you'll be asked for SSH credentials: username + password, or username + private key path (with an optional passphrase). NodeDeck test-connects before saving so you know immediately if something's wrong.

The very first time you connect to a device, NodeDeck trusts and remembers its SSH host key (the same trust-on-first-use model OpenSSH uses). If that device's key ever changes on a later connection — which normally only happens if it's been reimaged, or if something suspicious is intercepting the connection — NodeDeck blocks the connection instead of silently proceeding, and shows you the mismatch under **Credentials & Security**.

## Using a device

Click into a device from the Dashboard or Devices list and you'll get a tab bar:

- **Overview** — live CPU/RAM/temperature, a 2-minute CPU history graph, and quick-command shortcuts (disk usage, uptime, kernel version, etc.)
- **Terminal** — a real interactive SSH session (multiple tabs, split view)
- **Files** — browse both your machine and the device side-by-side; click a file in either pane to select it, then Upload/Download with a live progress bar
- **Monitor** — the same live stats as Overview, expanded
- **Processes & Services** — see what's running, restart/stop things
- **Logs** — live-tailed `journalctl`/`dmesg` output
- **Serial** — if the device (or something plugged into your Mac/PC) exposes a USB-serial port, open a session with configurable baud rate/parity/stop bits/flow control

## Fleet-wide tasks

**Tasks** (left sidebar) lets you define one operation — run a command, restart a service, collect diagnostics, download logs, upload a file, check disk space — and run it against a chosen set of devices at once, with live per-device status and the ability to retry just the ones that failed. Anything that could meaningfully affect a device (running an arbitrary command, restarting a service) requires you to explicitly confirm it's destructive before it runs.

## Everything else

- **Network Tools** — ping, DNS lookup, ARP table, port check, traceroute (all run locally on your machine, not over SSH to a device), an mDNS/Bonjour browser, and Wake-on-LAN
- **Shares** — start a temporary local HTTP server to hand someone a file over your LAN, with an optional password, expiry, and download limit
- **Credentials & Security** — edit saved device usernames/passwords, review/forget trusted SSH host keys, and see an audit log of sensitive actions (device added/removed, credentials changed, tasks created, imports/exports)
- **Settings** — switch accounts, set an auto-lock timeout, pick a theme, toggle demo devices on/off (fake devices for exploring the UI before you've connected anything real)

## Multiple accounts, one machine

Settings → **Switch account** logs you out and lets you unlock as a different local account, or create a new one. Every account's devices, tasks, and audit history are completely separate — switching accounts is not like switching profiles in a browser that share bookmarks; it's a fully isolated setup per person.

## Where your data lives

- **macOS**: `~/Library/Application Support/nodedeck/`
- **Windows**: `%APPDATA%\nodedeck\`
- **Linux**: `~/.config/nodedeck/`

That directory holds `nodedeck.db` (an embedded SQLite database — your devices, tasks, groups, and audit log) and `accounts.json` (your local account list, password-hashed with Argon2id). Device passwords are currently stored in that same local database, not your OS's keychain — see the note in [README.md](README.md#status) about that tradeoff. Nothing in that directory is ever sent anywhere by the app itself.

## Modifying the app

The codebase is a standard Tauri 2 project:

- `src/` — the React/TypeScript frontend. `src/screens/` has one folder per screen, `src/ipc/` are thin wrappers around calls into the Rust backend, `src/state/` is Zustand state.
- `src-tauri/src/core/` — the actual Rust logic (SSH, SFTP, discovery, the SQLite layer, etc.), independent of Tauri.
- `src-tauri/src/commands/` — thin `#[tauri::command]` wrappers that expose `core/` functions to the frontend.

To run it in development mode with hot reload:

```bash
npm run tauri dev
```

**If you add a new Tauri command**, it needs to be registered in three places or it'll silently fail to be callable from the frontend:
1. `src-tauri/build.rs` — add it to the `AppManifest::new().commands(&[...])` list
2. `src-tauri/capabilities/default.json` — add an `"allow-<kebab-case-name>"` permission
3. `src-tauri/src/lib.rs` — add it to the `tauri::generate_handler![...]` list

Rust unit tests: `cd src-tauri && cargo test`. TypeScript type-check: `npm run build` (runs `tsc -b` first).

Pull requests welcome — see [README.md](README.md#contributing).
