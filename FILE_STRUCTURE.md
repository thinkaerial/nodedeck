# File Structure — NodeDeck

Planned layout, pending architecture confirmation (Tauri 2.x + React/TypeScript UI + Rust core).

```
nodedeck/
├── STATUS.md
├── TASKS.md
├── FILE_STRUCTURE.md
├── CHECKLIST.md
├── SUGGESTIONS.md
├── DEVELOPMENT_PLAN.md          # written after Checkpoint 1
├── DB_SCHEMA.md                 # written after Checkpoint 1
├── API_DOCS.md                  # Rahul, grows as IPC commands land
├── DEPLOYMENT.md                # Rohan, Phase written at DevOps step
├── .env.example
├── src-tauri/                   # Rust core (Tauri backend)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── commands/            # typed IPC command handlers, one module per domain
│       │   ├── discovery.rs
│       │   ├── devices.rs
│       │   ├── ssh.rs
│       │   ├── sftp.rs
│       │   ├── monitor.rs
│       │   ├── serial.rs
│       │   ├── net_tools.rs
│       │   ├── sharing.rs
│       │   ├── tasks.rs
│       │   └── auth.rs
│       ├── core/                # domain logic, independent of Tauri glue
│       │   ├── discovery/       # mDNS, ARP, ICMP, TCP probe scanners
│       │   ├── ssh/             # SSH session mgmt, key auth, host-key verify
│       │   ├── sftp/            # transfer queue, resume, streaming
│       │   ├── monitor/         # collectors: cpu/ram/disk/temp/net
│       │   ├── serial/          # USB-serial listing + terminal
│       │   ├── sharing/         # share broker, tunnel client, token mgmt
│       │   ├── tasks/           # typed fleet task engine
│       │   └── security/        # OS keychain bridge, Argon2id, vault
│       ├── db/                  # SQLite access layer (sqlx or rusqlite)
│       │   ├── schema.sql
│       │   └── migrations/
│       └── workers/             # bounded worker pools (scan/transfer/monitor)
├── src/                         # React + TypeScript UI
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx
│   ├── ipc/                     # typed wrappers around Tauri invoke/events
│   │   ├── discovery.ts
│   │   ├── devices.ts
│   │   ├── ssh.ts
│   │   ├── sftp.ts
│   │   ├── monitor.ts
│   │   ├── serial.ts
│   │   ├── netTools.ts
│   │   ├── sharing.ts
│   │   ├── tasks.ts
│   │   └── auth.ts
│   ├── mocks/                   # mock data + mock IPC layer used during UI-first phase
│   ├── state/                   # global state (Zustand/Jotai) — devices, session, ui
│   ├── theme/                   # design tokens, light/dark palette, typography scale
│   ├── components/              # shared building blocks
│   │   ├── layout/              # app shell, sidebar, device header, tab bar
│   │   ├── data-display/        # tables, virtualized lists, badges, sparklines
│   │   ├── inputs/               # buttons, forms, dialogs, command palette
│   │   └── feedback/             # toasts, progress, empty/error states
│   └── screens/                  # one folder per IA screen (section 10 of spec)
│       ├── dashboard/
│       ├── network-scanner/
│       ├── devices/              # list + groups
│       ├── device-detail/
│       ├── terminal/
│       ├── files/
│       ├── monitor/
│       ├── processes-services/
│       ├── logs/
│       ├── serial/
│       ├── network-tools/
│       ├── shares/
│       ├── tasks/
│       ├── credentials-security/
│       └── settings/
└── tests/
    ├── ui/                      # component + screen tests
    └── core/                    # Rust unit/integration tests
```

## Notes
- `src/mocks/` exists specifically to support the UI-first build order: every screen ships against mock data first, then `src/ipc/*` is swapped from mock to real Tauri `invoke` calls module by module during the functionality phase — no screen layout work should be needed at that point.
- Each screen folder mirrors the IA list in section 10 of the requirements doc 1:1, so "finish one function at a time" maps directly to "finish one screen folder's mock→real wiring at a time."
