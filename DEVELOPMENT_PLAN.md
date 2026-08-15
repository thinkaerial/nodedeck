# Development Plan — NodeDeck

## Confirmed Tech Stack
- **Frontend:** React + TypeScript, Tailwind CSS, shadcn/ui-style component primitives
- **Desktop shell:** Tauri 2.x
- **Core service layer:** Rust (discovery, SSH/SFTP orchestration, transfer queues, monitoring collectors, sharing gateway, task engine)
- **SSH/SFTP:** audited Rust crates (`russh`/`ssh2`-class libraries) — no hand-rolled crypto
- **Local database:** SQLite (via `sqlx` or `rusqlite`) — devices, groups, metadata, share records, tasks, non-secret settings
- **Secrets:** macOS Keychain / Windows Credential Manager (DPAPI) via Tauri plugin or native bridge — never raw in SQLite/JSON
- **State management (UI):** Zustand
- **IPC:** typed Tauri commands + events, one module per domain (see FILE_STRUCTURE.md `src-tauri/src/commands/`)
- **Visual direction:** dense, dark-first ops console (compact rows, monospace for IPs/logs/terminal, inline sparklines)
- **Build order:** UI-first — all 15 screens built and polished against mock data before any screen is wired to real IPC/backend logic

## System Architecture
The Tauri shell hosts a React/TypeScript UI that never talks to the OS, network, or filesystem directly — every privileged operation crosses a typed IPC boundary into the Rust core. The Rust core is organized by domain (`core/discovery`, `core/ssh`, `core/sftp`, `core/monitor`, `core/serial`, `core/sharing`, `core/tasks`, `core/security`), each exposed through a thin `commands/*.rs` layer that the frontend calls via `invoke()`, with long-running work (scans, transfers, monitoring streams) pushed back to the UI as Tauri events rather than polled. Bounded worker pools (`workers/`) throttle concurrent scans/transfers/monitoring so idle CPU/RAM stay within the section-6 budget. SQLite holds structural data (devices, groups, tasks, share metadata); OS-native secure storage holds all secrets, with the two never overlapping. During the UI-first phase, `src/mocks/` stands in for the entire `src/ipc/*` layer so screens are fully interactive before a single Rust command exists; functionality work later swaps one `ipc/*.ts` module at a time from mock to real `invoke()` calls without touching screen layout.

## API / IPC Command Surface (by domain)
| Domain | Tauri commands (indicative) | Notes |
|---|---|---|
| auth | `auth_login`, `auth_unlock_vault`, `auth_lock`, `auth_set_role` | Argon2id, OS keychain bridge |
| discovery | `discovery_scan`, `discovery_stop`, event: `discovery_device_found` | mDNS/ARP/ICMP/TCP probe |
| devices | `devices_list`, `devices_save`, `devices_delete`, `devices_import`, `devices_export` | SQLite-backed |
| ssh | `ssh_connect`, `ssh_disconnect`, `ssh_exec`, `ssh_verify_hostkey`, event: `ssh_data` | key/agent/password auth |
| sftp | `sftp_list_dir`, `sftp_transfer`, `sftp_resume`, `sftp_cancel`, event: `sftp_progress` | streaming, range-aware resume |
| monitor | `monitor_start`, `monitor_stop`, event: `monitor_snapshot` | adaptive interval, pauses on inactive/minimized/battery |
| processes | `processes_list`, `processes_kill`, `services_status`, `services_restart` | Linux targets only |
| logs | `logs_tail_start`, `logs_tail_stop`, event: `logs_line` | journalctl or configurable source |
| serial | `serial_list_ports`, `serial_open`, `serial_close`, event: `serial_data` | USB-UART adapters |
| net_tools | `net_ping`, `net_dns_lookup`, `net_arp_table`, `net_port_check`, `net_traceroute`, `net_wol` | |
| sharing | `share_create`, `share_revoke`, `share_list`, event: `share_access_logged` | broker/tunnel, token-based |
| tasks | `task_create`, `task_run`, `task_cancel`, event: `task_result` | typed tasks, group/tag targeting |

Full request/response shapes documented in `API_DOCS.md` as each command is implemented (Stage 2, TASKS.md).

## Dev 1 Scope (Rahul)
Stage 0 project setup, then all of Stage 2 (Rust core + IPC commands + SQLite + secure storage), API_DOCS.md maintained as each command lands.

## Dev 2 Scope (Ananya)
All of Stage 1 (15 screens + command palette, mock data only), then Stage 2 wiring: swap each `src/ipc/*.ts` module from mock to real `invoke()` calls as Rahul completes the matching Rust command set.
