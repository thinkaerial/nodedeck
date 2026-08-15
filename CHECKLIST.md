# Development Checklist — NodeDeck

## Phase 1 — Discovery
- [x] Requirements read (Companion_Computer_Manager_Technical_Requirements.docx)
- [x] TASKS.md created
- [x] FILE_STRUCTURE.md created
- [x] SUGGESTIONS.md created (competitive UI/UX comparison + product opinion)

## Phase 2 — Architecture (confirmed 2026-08-15)
- [x] Tech stack confirmed by user (Tauri + Rust + React/TS, Tailwind, dark-first ops console)
- [x] DEVELOPMENT_PLAN.md written
- [x] DB_SCHEMA.md written

## Phase 3 — Project Setup
- [x] Tauri + React + TS project initialized and running
- [x] Design tokens / theme (dark-first ops console) established
- [x] App shell (sidebar, top bar, device header, tab bar) in place
- [x] Mock data layer in place (`src/mocks/`) — real `src/ipc/*` layer not started yet

## Phase 4 — UI/UX: All 15 Screens (mock data)
- [x] Dashboard
- [x] Network Scanner
- [x] Devices / Groups
- [x] Device Detail (Overview tab; Terminal/Files/Monitor/Processes/Logs/Serial share the device header+tabs)
- [x] Terminal
- [x] Files
- [x] Monitor
- [x] Processes & Services
- [x] Logs
- [x] Serial
- [x] Network Tools
- [x] Shares
- [x] Tasks / Automation
- [x] Credentials / Security
- [x] Settings
- [x] Command palette (⌘K)
- [ ] Light theme pass (dark-first theme is done; light variant of tokens exists in index.css but untested across screens)

## Phase 5 — Functionality (one module at a time, per TASKS.md Stage 2)
- [ ] Application auth/vault
- [ ] Network discovery
- [ ] Device inventory & profiles
- [ ] SSH terminal
- [ ] SFTP file manager
- [ ] System/hardware monitoring
- [ ] Processes & services control
- [ ] Log tailing
- [ ] Serial support
- [ ] Network utilities
- [ ] Fleet task engine
- [ ] Public sharing
- [ ] Credentials/security surface
- [ ] Resource optimization pass

## Phase 6 — QA
- [ ] Test cases written per screen/module
- [ ] All functional tests passing
- [ ] Responsiveness/window-size verified
- [ ] Resource budget verified (idle CPU <1%, idle RAM ~100–200MB)
- [ ] TEST_REPORT.md created

## Phase 7 — Deployment
- [ ] macOS signed/notarized build
- [ ] Windows signed installer/MSIX build
- [ ] DEPLOYMENT.md written
