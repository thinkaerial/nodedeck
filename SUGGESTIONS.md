# Suggestions & Competitive Analysis — NodeDeck

## Similar Apps

- **Royal TSX** (macOS/Windows, paid): connection organization via folders, credential inheritance down a tree, gateways (SSH jump hosts), reusable "tasks", and a mature SFTP/SCP file-transfer pane. Strongest at *hierarchy and credential reuse* — you set a credential once on a folder and every device under it inherits it.
- **Termora** (open source, cross-platform): clean host tree, tabbed SSH terminal, GUI SFTP pane, key management, quick "system info" panel per host. Strongest at being *lightweight and fast to open a session* — minimal chrome, keyboard-driven.
- **electerm** (open source, Electron): broadest protocol coverage — SSH/SFTP/Serial/RDP/VNC/Telnet in one shell. Strongest at *protocol breadth*, weakest at resource usage (Electron) and at monitoring/fleet features.
- **Voltius** (macOS-first): local-first SSH/SFTP/Serial with persistent workspaces, drag-and-drop transfer, process management and live system monitoring baked into the same window as the terminal. Closest single analog to what this spec describes — it treats "connect" and "monitor" as one workflow instead of separate apps.

## Features This App Should Have (not explicitly in current scope, worth adding)

- **Command palette (Cmd/Ctrl+K)** — jump to any device, run any quick command, open any panel without touching the mouse. None of the four references do this well; it would be a differentiator for a "command center" positioning.
- **Session/tab restore on relaunch** — reopen the terminal tabs and file-manager panes that were open when the app closed (Voltius does this; it matters a lot for field engineers who leave a laptop lid closed overnight).
- **Per-device "quick glance" badge in the device list** — a tiny inline CPU/temp/online sparkline in the list row itself (not just in Device Detail), so a fleet operator scans health without opening each device.
- **Diff/compare tool for config files across devices** — useful specifically for a fleet of Pis/Jetsons running the same image; not in the spec but cheap to add once SFTP + Tasks exist.
- **Local snapshot of "last known good" device state** — before a destructive fleet task runs, capture disk/service state so a rollback report is possible.

## Features in Current Scope That Are Industry Standard (confirmed as right calls)

- Encrypted OS-native credential storage (Keychain/DPAPI) instead of app-level plaintext — matches Royal TSX and Termora.
- Host-key/fingerprint verification with an explicit first-connect trust step — table stakes for any serious SSH client, and a common miss in hobby tools.
- Direct-from-source file sharing (no mandatory cloud copy) — genuinely differentiated; none of the four reference apps offer public sharing at all, this is NodeDeck's own feature, not a clone of anything.
- Typed "Tasks" instead of arbitrary broadcast shell exec by default — matches Royal TSX's task model and is safer than electerm's raw multi-exec.

## Relevance Analysis

This fills a real gap: today a drone/edge-hardware engineer runs Fing (discovery) + Terminal (SSH) + Cyberduck/FileZilla (SFTP) + htop-over-SSH (monitoring) + a serial terminal app + something like WeTransfer or a personal cloud bucket (sharing) — six tools for one workflow. NodeDeck's pitch is collapsing that into one local-first, low-resource window. The target user is small teams operating fleets of Raspberry Pi / Jetson / Radxa / Luckfox boards (drone companion computers, field robotics, edge AI rigs) — not generic IT server admins, which is why Royal TSX-style "enterprise server fleet" framing is the wrong reference to over-index on; Voltius's "one hacker's toolbox" framing is closer to right.

## Recommended Future Roadmap (post Phase 4)

1. Pixhawk/MAVLink telemetry adapter maturation — this is the actual wedge into the drone-ops niche the spec hints at in section 3.6/13.
2. Team sync (opt-in): shared device inventory + role model (Admin/Engineer/Operator/Viewer already scoped) becomes valuable once >1 person touches the same fleet.
3. Scriptable Tasks (safe DSL, not raw shell) so power users can compose beyond the built-in task types without reopening the "arbitrary shell exec" risk.
4. Plugin API for additional companion-computer adapters (spec already calls for lazy-loaded hardware adapters — formalize it as a public plugin interface once Phase 4 ships).

## My Take (Arjun / Vikram, for the record)

The scope is coherent and the "local-first, low-resource, one-click SSH→Files→Monitor" spine is the right core loop — it's what Voltius gets right and what makes this more than "another Termius clone." The riskiest parts of the spec, in order:

1. **Public file sharing (section 3.8/7)** is the most complex subsystem relative to its payoff — it requires a broker/tunnel service, token security, rate limiting, and it's the one feature that turns this from "local tool" into "thing with an internet-facing attack surface." Recommend building it last (Phase 3, as the doc already schedules) and treating it as an optional module the user must explicitly enable.
2. **Resource budget (<1% idle CPU, ~100–200MB idle RAM)** is a real engineering constraint, not a nice-to-have — it should be tested continuously starting from the first working build, not audited at the end. Recommend Kavya track this as a standing regression check once any monitoring/polling code exists.
3. **Tauri + Rust core is the correct call** for this spec specifically because SSH/SFTP/serial/monitoring collectors are exactly the kind of always-on background work Electron is bad at keeping cheap. This diverges from this codebase's usual default (see Technology Defaults) and that divergence is justified by the resource-budget requirement in section 6 — flagging it explicitly at the architecture checkpoint.
4. **UI-first build order** (per your instruction) is sound for this project in particular: 15 distinct screens (section 10) sharing a device-context header (section 11) means getting the navigation shell, device header, and panel layout right once, with mock data, avoids rebuilding layout scaffolding 15 times as backend pieces land in different order.
