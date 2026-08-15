use anyhow::Result;
use serde::Serialize;

use super::ssh::{self, ConnectionParams};
use super::ssh_pool::SshPool;

#[derive(Debug, Clone, Serialize)]
pub struct MonitorSnapshot {
    pub load_1m: f32,
    pub mem_total_mb: u64,
    pub mem_used_mb: u64,
    pub disk_total: String,
    pub disk_used: String,
    pub disk_used_pct: u8,
    pub temp_c: Option<f32>,
    pub uptime_seconds: u64,
    pub raw: String,
}

const PROBE_COMMAND: &str = r#"
echo __CPU__; cat /proc/loadavg;
echo __MEM__; free -m;
echo __DISK__; df -h / | tail -n 1;
echo __TEMP__; (vcgencmd measure_temp 2>/dev/null || cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo n/a);
echo __UPTIME__; cat /proc/uptime;
"#;

pub async fn snapshot(pool: &SshPool, params: &ConnectionParams) -> Result<MonitorSnapshot> {
    let result = ssh::exec_pooled(pool, params, PROBE_COMMAND).await?;
    Ok(parse(&result.stdout))
}

fn section(raw: &str, marker: &str) -> String {
    let after = raw.split(marker).nth(1).unwrap_or("");
    let next_marker_pos = after.find("__").unwrap_or(after.len());
    after[..next_marker_pos].trim().to_string()
}

fn parse(raw: &str) -> MonitorSnapshot {
    let cpu = section(raw, "__CPU__");
    let mem = section(raw, "__MEM__");
    let disk = section(raw, "__DISK__");
    let temp = section(raw, "__TEMP__");
    let uptime = section(raw, "__UPTIME__");

    let load_1m = cpu
        .split_whitespace()
        .next()
        .and_then(|v| v.parse::<f32>().ok())
        .unwrap_or(0.0);

    // `free -m` header line + a data line starting with "Mem:"
    let mut mem_total_mb = 0u64;
    let mut mem_used_mb = 0u64;
    for line in mem.lines() {
        if let Some(rest) = line.strip_prefix("Mem:") {
            let cols: Vec<&str> = rest.split_whitespace().collect();
            mem_total_mb = cols.first().and_then(|v| v.parse().ok()).unwrap_or(0);
            mem_used_mb = cols.get(1).and_then(|v| v.parse().ok()).unwrap_or(0);
        }
    }

    // `df -h /` tail line: Filesystem Size Used Avail Use% Mounted
    let disk_cols: Vec<&str> = disk.split_whitespace().collect();
    let disk_total = disk_cols.get(1).unwrap_or(&"?").to_string();
    let disk_used = disk_cols.get(2).unwrap_or(&"?").to_string();
    let disk_used_pct = disk_cols
        .get(4)
        .and_then(|v| v.trim_end_matches('%').parse::<u8>().ok())
        .unwrap_or(0);

    // vcgencmd → "temp=45.6'C" ; thermal_zone0 → millidegrees, e.g. "45678"
    let temp_c = if let Some(v) = temp.strip_prefix("temp=") {
        v.trim_end_matches("'C").parse::<f32>().ok()
    } else {
        temp.trim().parse::<f32>().ok().map(|milli| milli / 1000.0)
    };

    let uptime_seconds = uptime
        .split_whitespace()
        .next()
        .and_then(|v| v.parse::<f32>().ok())
        .map(|s| s as u64)
        .unwrap_or(0);

    MonitorSnapshot {
        load_1m,
        mem_total_mb,
        mem_used_mb,
        disk_total,
        disk_used,
        disk_used_pct,
        temp_c,
        uptime_seconds,
        raw: raw.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_vcgencmd_temp_format() {
        let raw = "__CPU__\n0.05 0.02 0.25 1/234 5678\n\
__MEM__\n              total        used        free      shared  buff/cache   available\nMem:            426         185          63           2         178         203\nSwap:             0           0           0\n\
__DISK__\n/dev/root        29G  4.6G   23G  17% /\n\
__TEMP__\ntemp=39.0'C\n\
__UPTIME__\n2516.42 9800.11\n";

        let snap = parse(raw);
        assert!((snap.load_1m - 0.05).abs() < 1e-6);
        assert_eq!(snap.mem_total_mb, 426);
        assert_eq!(snap.mem_used_mb, 185);
        assert_eq!(snap.disk_total, "29G");
        assert_eq!(snap.disk_used, "4.6G");
        assert_eq!(snap.disk_used_pct, 17);
        assert_eq!(snap.temp_c, Some(39.0));
        assert_eq!(snap.uptime_seconds, 2516);
    }

    #[test]
    fn parses_thermal_zone_millidegree_format() {
        let raw = "__CPU__\n0.10 0.20 0.30 2/300 999\n\
__MEM__\n              total        used        free      shared  buff/cache   available\nMem:           7945        1200        4000          50        2745        6500\nSwap:             0           0           0\n\
__DISK__\n/dev/sda1       100G   40G   55G  42% /\n\
__TEMP__\n45678\n\
__UPTIME__\n100.0 50.0\n";

        let snap = parse(raw);
        assert_eq!(snap.disk_used_pct, 42);
        assert_eq!(snap.temp_c, Some(45.678));
        assert_eq!(snap.mem_total_mb, 7945);
        assert_eq!(snap.mem_used_mb, 1200);
    }

    #[test]
    fn handles_missing_temp_gracefully() {
        let raw = "__CPU__\n0.0 0.0 0.0 1/1 1\n\
__MEM__\nMem: 100 50 50 0 0 90\n\
__DISK__\n/dev/x 1G 1G 0G 100% /\n\
__TEMP__\nn/a\n\
__UPTIME__\n1.0 1.0\n";

        let snap = parse(raw);
        assert_eq!(snap.temp_c, None);
    }
}
