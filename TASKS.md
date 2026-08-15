# Tasks — NodeDeck

Ordering followed the user's original directive: **all UI/UX first (mock data, no backend wiring), then functionality implemented one module at a time.** UI-first phase is complete; the app is now deep into Stage 2 real-device integration, verified against a live Raspberry Pi (10.104.17.161) wherever noted.

## Stage 0 — Project Setup
- [x] Tauri 2.x + React + TypeScript project (`src-tauri/`, `src/`)
- [x] TypeScript strict mode via `tsc --noEmit` (kept clean throughout)
- [x] Tailwind v4 + design tokens (dark-first ops console theme, light variant exists)
- [x] Zustand state scaffolding (UI store, real-devices store, session store, theme store)
- [x] Routing between screens (react-router)
- [x] Mock data layer (`src/mocks/`) — now gated behind a "show demo devices" toggle, off by default once a real device exists
- [x] Base app shell: sidebar nav, top bar (now shows live device/online counts), device-context header, tab bar

## Stage 1 — UI/UX: All Screens
All 15 screens + command palette built. Every screen with no real backend yet shows an honest empty state instead of fake data (gated behind the demo-devices toggle for preview).
- [x] Dashboard, Network Scanner, Devices/Groups, Device Detail, Terminal, Files, Monitor, Processes & Services, Logs, Serial, Network Tools, Shares, Tasks/Automation, Credentials/Security, Settings, Command palette
- [x] Dark theme pass (primary); Light/System theme now actually functional (Settings → Appearance), not just visual
- [ ] Responsive/window-resize behavior — never explicitly tested across window sizes

## Stage 2 — Functionality

### Real and verified
- [x] **Network discovery** — TCP port-22 probe across a CIDR (max /22) + local ARP cache cross-reference for MAC/vendor; CIDR auto-detected from the active interface. Verified standalone against the real Pi (found it with correct MAC/vendor).
- [x] **Device inventory** — add by IP or from scan results (`AddDeviceModal`), persisted in embedded SQLite (`core/db.rs`, `rusqlite` bundled — compiled into the binary, no separate SQLite install, one `nodedeck.db` file in the app's own data dir). Auto-migrates any devices left over from the earlier localStorage-only version on first load. Editable alias (Device page "Edit") and editable username/password with re-test-on-save (Credentials & Security page). 2 passing Rust unit tests (insert/list/delete round-trip, upsert doesn't duplicate).
- [x] **Device liveness heartbeat** — background TCP port-22 check every 20s for every saved device, app-wide (not just when its screen is open), so the sidebar/list/status badges reflect reality instead of a stale "online" set at add-time.
- [x] **SSH connection pooling** — one persistent authenticated connection per device, reused across Terminal/Files/Monitor/Processes/Logs/quick-commands instead of a fresh TCP+SSH handshake per action.
- [x] **Connect/tool timeouts** — `ssh::connect` had NO timeout on the initial TCP connect; against an unreachable host this could hang 60-75s (macOS default), and every feature routes through it. Now wrapped at 6s. Verified live against the (currently offline) Pi: fails in 6.7s instead of hanging. Also added a 25s hard cap + `kill_on_drop` to the local network-tool runner (ping/dns/arp/traceroute) so none of those can hang indefinitely either. Device heartbeat's port-check timeout cut from 4s→1.5s and parallelized across devices instead of checking one at a time.
- [x] **SSH terminal** — real interactive PTY (russh + xterm.js), password auth, quick-commands sidebar sends real input, now pool-backed.
- [x] **SFTP file browsing** — read-only, pool-backed.
- [x] **Local file browsing** — read-only, cross-platform via `dirs` crate.
- [x] **System monitoring** — CPU load/RAM/disk/temp/uptime via SSH exec, polled every 8s, pool-backed.
- [x] **Processes & services** — real `ps`/`systemctl` over the pooled SSH connection, read-only.
- [x] **Log tailing** — real `journalctl`/`dmesg` polling (6s) over SSH, read-only.
- [x] **Network utilities** — ping/DNS/ARP/port-check/traceroute, run locally on the Mac.
- [x] **File transfer (upload/download)** — click a file in either Files pane to select it, Upload/Download streams it via SFTP in fixed 128KB chunks (never buffers a whole file in RAM, so multi-GB transfers cost constant memory), with a live progress bar driven by real `transfer:progress` events per chunk. Selection-based, not drag-and-drop (a real front-end feature I scoped out for time — clicking is fully functional, dragging between panes isn't wired). No pause/resume yet. Could not verify end-to-end against the real Pi this session (offline) — verified via `cargo check`/`tsc` only.
- [x] **Public sharing** — local HTTP server (axum) streams a chosen file over a token URL with optional password/expiry/download-limit/revoke/access-log. Verified end-to-end with real HTTP requests (401/401/200/410). LAN-reachable only — outside-LAN access needs a tunnel/relay, an infrastructure/cost decision not yet made.
- [x] **Device actions** — Reconnect (re-test), Reboot (`sudo reboot` over SSH, behind a type-the-device-name confirm), Remove, Edit alias, Share/Diagnostics shortcuts. Disabled with a tooltip for demo (non-real) devices.
- [x] **Device Overview tab bugfix** — was showing hardcoded fake "Auth method: SSH key (agent)", "Gateway: None" for real devices too (never gated on real vs. demo). Now shows real connection info, live CPU load/RAM/temp for real devices, and quick commands actually execute over SSH with visible output instead of being inert.
- [x] **Command palette bugfix** — device search (⌘K) always listed the 6 fake demo devices regardless of the demo-devices toggle. Now uses the same real/demo device list as everywhere else.
- [x] **App login — multi-user** — real multiple independent local accounts (username → Argon2id hash), not just one. Every device, group, task, and audit-log row is scoped to whoever's logged in — switching accounts shows a fully separate setup, not a shared pool. Unlock screen has a username picker + "add another account"; Settings has a real "Switch account" (logout) action. Migrates the original single-account file automatically (verified against this machine's real account, not just a test). 6 passing Rust unit tests (create/verify, duplicate-username rejection, min-length, multi-account isolation, unknown-username rejection, legacy-file migration).
- [x] **Auto-lock** — configurable timeout (Settings → Security), re-locks the app after inactivity.
- [x] **Touch ID unlock** — real macOS LocalAuthentication FFI (`objc2` bindings), not a stub. Compiles clean; **I could not verify the actual fingerprint prompt fires correctly** — no way to trigger your Touch ID sensor from here. Needs your real-world test.
- [x] **Serial** — real USB-serial device listing (`serialport` crate, filtered to USB devices) and a working terminal: open with baud/parity/stop-bits/flow-control, read/write over a background OS thread (the crate is blocking std::io, not async), streamed to the UI as events exactly like the SSH PTY. Verified port listing standalone (correctly reports 0 with nothing plugged in — could not verify actual data flow, no USB-serial device on hand this session).
- [x] **Fleet task engine** — real, typed tasks per spec section 12 (not arbitrary shell exec by default): run command, restart service, check disk, collect diagnostics, download logs, upload file. Stored in SQLite (`tasks`/`task_runs` tables), targets a set of real devices, runs concurrently across them (bounded by fleet size, not hundreds), live per-device status (queued→running→success/failed) via `task:update` events, retry-failed re-queues and re-runs. Destructive types (`run_command`, `restart_service`) require an explicit "this is destructive" confirmation step in the New Task modal, matching spec section 12. 3 passing Rust unit tests (config parsing, destructive-flag classification). Not yet: group/tag targeting (device-by-device selection only), bounded retry limits (retry is manual/unlimited, not auto-capped).

- [x] **mDNS/Bonjour discovery** — real `mdns-sd` browse for `_ssh._tcp`, `_workstation._tcp`, `_device-info._tcp` (4s window) in Network Tools. Ran it standalone against the real LAN: **0 results** — the mechanism runs without erroring, but I can't confirm it actually *works* since I got nothing back. Plausibly because nothing on this network currently advertises those service types over mDNS (many minimal Pi OS images don't publish `_ssh._tcp` by default) — or a subtler bug I can't diagnose without a device that does advertise it. Flagged honestly in the UI's empty state, not claimed as verified.
- [x] **Wake-on-LAN** — real magic-packet broadcast (UDP port 9) in Network Tools, 3 passing unit tests for MAC address parsing (colon/dash formats, rejects malformed). Untested against real hardware — sending the packet is easy to verify compiles/runs, but confirming a device actually wakes needs a WoL-enabled device to test against, which I don't have.

- [x] **Custom device groups** — real create/list/delete (SQLite `groups` table, owner-scoped), sidebar "+" on Devices screen actually works now.
- [x] **Bulk import/export** — real JSON import/export matching spec 3.2 ("open, documented format" — plain JSON in our own DbDevice shape, no bespoke schema). Both buttons wired; UI warns that the file includes credentials in plaintext.
- [x] **Audit logging** — real SQLite-backed log (owner-scoped), records device add/update/remove, group create, task create, import/export. Credentials & Security shows real entries instead of demo-gated mock data.

### Explicitly not built

### Known security/robustness gaps (real, not hidden)
- [x] **SSH host-key verification** — real trust-on-first-use + mismatch detection (`core/known_hosts.rs`), 2 passing Rust unit tests. First connect to a device saves its key fingerprint (SHA256); if that fingerprint ever changes on a later connection, the connection is hard-blocked with a clear error instead of silently proceeding. Credentials & Security shows each device's trusted fingerprint with a "Forget key" recovery action for legitimate key changes (device reimaged). Could not test the live handshake path end-to-end this session (Pi offline) — the storage/compare logic is unit-tested, but I haven't watched a real mismatch get blocked with my own eyes.
- [~] **Device credential vault** — implemented but intentionally not wired in. `core/vault.rs` + `commands/vault.rs` + `ipc/vault.ts` give a working OS-keychain-backed store (`keyring` crate: macOS Keychain / Windows Credential Manager), verified standalone (set/get/delete round-trip against the real macOS Keychain). Not used by the app: not every user has Keychain/Credential Manager reliably available, and in dev builds macOS ties Keychain ACLs to the binary's code signature, so an unsigned dev binary would re-prompt for access on every rebuild. Device passwords are saved in the app's own local storage instead — plaintext, same tradeoff as before. Revisit wiring the vault in once the app is consistently code-signed.
- [x] **SSH key auth** — `AddDeviceModal` now has a Password/SSH key toggle; key path + optional passphrase, `~` expanded to home dir in Rust (3 passing unit tests for the expansion logic itself). Uses `authenticate_publickey` via `russh::keys::load_secret_key`. Not yet: SSH agent forwarding (asking `ssh-agent` for keys rather than reading a key file directly) — file-based key auth only.
- [x] **SQLite** — device inventory now lives in embedded SQLite (see above). Everything else (UI prefs, session, theme) is still localStorage — reasonable, none of it is data that needs querying/relations. Device passwords remain plaintext in the DB — see the vault entry above.
- [ ] Resource budget — spec wants <1% idle CPU, ~150MB idle RAM; never measured.
- [ ] Windows — code has cross-platform branches (ping/traceroute/arp/paths) but has only ever been run on this Mac. Unverified on Windows.

## Testing
- [x] Rust unit tests: 25 passing — monitor parsing (3), app auth incl. multi-user + legacy migration (6), known-hosts store (2), tilde expansion (3), SQLite device/group/audit store incl. per-owner isolation (5), task engine (3), Wake-on-LAN MAC parsing (3)
- [x] Manual end-to-end verification via standalone examples for: SSH exec/monitor/SFTP, discovery scan, public-sharing HTTP flow
- [ ] No frontend test suite (no Vitest/RTL tests written)
- [ ] No systematic responsiveness/window-size testing
- [ ] Resource budget regression checks — not started

## Deployment
- [ ] Dockerfile / build scripts — not needed for a desktop app, likely skip
- [ ] macOS signed/notarized .app + DMG — needs your Apple Developer account/certificate, can't do without it
- [ ] Windows signed installer — needs a code-signing certificate, can't do without it
- [ ] Update channel setup
- [ ] DEPLOYMENT.md
