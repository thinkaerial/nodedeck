# Database Schema — NodeDeck (SQLite)

No secrets are ever stored here — passwords, private keys, and share tokens live in OS-native secure storage and are referenced by opaque ID only.

## Table: devices
| Field | Type | Required | Description |
|---|---|---|---|
| id | TEXT (UUID) | Yes | Primary key |
| alias | TEXT | Yes | User-facing name |
| device_type | TEXT | Yes | raspberry_pi \| jetson \| radxa \| luckfox \| linux_pc \| windows_pc \| unknown |
| last_ip | TEXT | No | Last known IPv4/IPv6 |
| last_hostname | TEXT | No | Last known mDNS/hostname |
| mac_vendor | TEXT | No | MAC vendor string from discovery |
| ssh_port | INTEGER | No | Default 22 |
| ssh_username | TEXT | No | |
| auth_method | TEXT | No | key \| agent \| password (actual secret in OS vault) |
| credential_ref | TEXT | No | Opaque ID into OS secure storage |
| initial_remote_path | TEXT | No | Default SFTP/terminal path |
| proxy_gateway_id | TEXT | No | FK → devices.id (jump host) |
| group_id | TEXT | No | FK → groups.id |
| notes | TEXT | No | |
| icon | TEXT | No | |
| last_seen_at | DATETIME | No | |
| created_at | DATETIME | Yes | |
| updated_at | DATETIME | Yes | |

## Table: groups
| Field | Type | Required | Description |
|---|---|---|---|
| id | TEXT (UUID) | Yes | Primary key |
| name | TEXT | Yes | |
| parent_group_id | TEXT | No | Self-referencing FK, for folder hierarchy |
| created_at | DATETIME | Yes | |

## Table: device_tags
| Field | Type | Required | Description |
|---|---|---|---|
| device_id | TEXT | Yes | FK → devices.id |
| tag | TEXT | Yes | |

## Table: serial_profiles
| Field | Type | Required | Description |
|---|---|---|---|
| id | TEXT (UUID) | Yes | Primary key |
| device_id | TEXT | No | FK → devices.id, nullable for standalone serial devices |
| port_name | TEXT | Yes | e.g. /dev/cu.usbserial-XXXX or COM3 |
| baud_rate | INTEGER | Yes | |
| parity | TEXT | Yes | |
| stop_bits | TEXT | Yes | |
| flow_control | TEXT | Yes | |

## Table: shares
| Field | Type | Required | Description |
|---|---|---|---|
| id | TEXT (UUID) | Yes | Primary key |
| device_id | TEXT | No | FK → devices.id, null if local file |
| source_path | TEXT | Yes | Path on source disk (never copied) |
| token_ref | TEXT | Yes | Opaque ID into OS secure storage (actual token) |
| password_protected | BOOLEAN | Yes | Default false |
| expires_at | DATETIME | No | |
| download_limit | INTEGER | No | |
| download_count | INTEGER | Yes | Default 0 |
| revoked | BOOLEAN | Yes | Default false |
| created_at | DATETIME | Yes | |

## Table: share_access_log
| Field | Type | Required | Description |
|---|---|---|---|
| id | INTEGER (autoincrement) | Yes | Primary key |
| share_id | TEXT | Yes | FK → shares.id |
| accessed_at | DATETIME | Yes | |
| ip_hash | TEXT | No | Hashed, not raw IP, for privacy |
| bytes_transferred | INTEGER | No | |

## Table: tasks
| Field | Type | Required | Description |
|---|---|---|---|
| id | TEXT (UUID) | Yes | Primary key |
| name | TEXT | Yes | |
| task_type | TEXT | Yes | upload_file \| download_logs \| restart_service \| run_command \| check_disk \| collect_diagnostics |
| config_json | TEXT | Yes | Typed task parameters, serialized |
| target_group_id | TEXT | No | FK → groups.id |
| target_tag | TEXT | No | |
| requires_confirmation | BOOLEAN | Yes | Default true for destructive types |
| created_at | DATETIME | Yes | |

## Table: task_runs
| Field | Type | Required | Description |
|---|---|---|---|
| id | TEXT (UUID) | Yes | Primary key |
| task_id | TEXT | Yes | FK → tasks.id |
| device_id | TEXT | Yes | FK → devices.id |
| status | TEXT | Yes | queued \| running \| success \| failed \| skipped |
| retry_count | INTEGER | Yes | Default 0 |
| started_at | DATETIME | No | |
| finished_at | DATETIME | No | |
| result_summary | TEXT | No | |

## Table: audit_log
| Field | Type | Required | Description |
|---|---|---|---|
| id | INTEGER (autoincrement) | Yes | Primary key |
| actor | TEXT | Yes | Local user/role |
| action | TEXT | Yes | e.g. share_created, task_run, service_restart |
| target | TEXT | No | Device ID / share ID / task ID |
| at | DATETIME | Yes | |

## Table: settings
| Field | Type | Required | Description |
|---|---|---|---|
| key | TEXT | Yes | Primary key |
| value_json | TEXT | Yes | Scan profiles, monitoring intervals, update channel, theme, etc. |

## Indexes
- devices: last_ip, group_id
- device_tags: device_id, tag
- shares: device_id, revoked
- share_access_log: share_id
- task_runs: task_id, device_id, status
- audit_log: at

## Relationships
- devices.group_id → groups.id
- devices.proxy_gateway_id → devices.id (self-reference for SSH gateways)
- device_tags.device_id → devices.id
- serial_profiles.device_id → devices.id
- shares.device_id → devices.id
- share_access_log.share_id → shares.id
- tasks.target_group_id → groups.id
- task_runs.task_id → tasks.id
- task_runs.device_id → devices.id
