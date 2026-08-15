# Thinkaerial Dev Team — Live Status

## Project: NodeDeck (Companion Computer Manager)
## Active Task: Stage 2 real-device integration — deep pass, verified against a live Raspberry Pi
## Last Updated: 2026-08-15

| Agent | Name | Status | Current Work |
|---|---|---|---|
| Manager | Arjun | 🟢 Active | Monitoring workflow |
| Analyst | Priya | ✅ Done | Planning docs created |
| Architect | Vikram | ✅ Done | Architecture confirmed, DEVELOPMENT_PLAN.md + DB_SCHEMA.md written |
| Developer 1 | Rahul | 🟢 Active | SSH connection pooling, device heartbeat, app auth/Touch ID, public sharing server all built and tested |
| Developer 2 | Ananya | 🟢 Active | All screens wired to real IPC or honest empty states; device action bar, credential editing, live status counts |
| QA Engineer | Kavya | 🟡 Partial | Rust unit tests passing (6/6); no frontend test suite yet; resource budget unmeasured |
| DevOps | Rohan | 😴 Sleeping | Packaging blocked on user's Apple/Windows signing credentials |

## What's real right now (see TASKS.md for full detail)
Discovery, device add/persist/edit/remove, SSH terminal (pooled), SFTP browsing, local file browsing, monitoring, processes/services, logs, network tools, public sharing, app login + Touch ID + auto-lock, device liveness heartbeat.

## What's explicitly not built (honest empty states, not fake data)
Serial, fleet tasks, mDNS/WoL, file transfer, bulk import/groups, audit log, credential vault (OS Keychain), host-key verification, SQLite, resource-budget measurement, Windows testing.

## Root causes fixed this session (worth remembering)
- **Every IPC call was silently blocked** for most of this session — Tauri v2's permission system requires every custom command to be explicitly declared (`build.rs` + `capabilities/default.json`); this app had zero such declarations until diagnosed and fixed. If a new command is added and "does nothing" in the GUI despite compiling, check this first.
- **Perceived slowness (Terminal/Files slow to open)** was a fresh SSH TCP+handshake+auth on every single action. Fixed with a per-device connection pool (`core/ssh_pool.rs`) — one connection reused across Terminal/Files/Monitor/Processes/Logs.
- **Device status going stale** (showing "online" for an offline device) — there was no background liveness check. Fixed with a 20s app-wide TCP heartbeat.

## Notes
- Not a git repo yet — still recommend `git init` once the user is satisfied with current state.
- The Pi at 10.104.17.161 went offline mid-session (confirmed via ping/port-22 from the Mac, same subnet as before — not a NodeDeck bug). Connection pooling and heartbeat logic compiled and unit-tested but could not be re-timed against real hardware in this session; needs a retest once the Pi is back online.
- User has 5 more Pi-class devices to bring onto NodeDeck once satisfied with this one.
