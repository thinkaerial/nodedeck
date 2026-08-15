use anyhow::Result;
use serde::Serialize;
use serialport::SerialPortType;

#[derive(Debug, Clone, Serialize)]
pub struct SerialPortEntry {
    pub path: String,
    pub label: String,
}

/// Lists USB-serial devices attached to this machine (spec section 3.6).
pub fn list_ports() -> Result<Vec<SerialPortEntry>> {
    let ports = serialport::available_ports()?;
    Ok(ports
        .into_iter()
        .filter(|p| matches!(p.port_type, SerialPortType::UsbPort(_)))
        .map(|p| {
            let label = match &p.port_type {
                SerialPortType::UsbPort(info) => {
                    let product = info.product.clone().unwrap_or_else(|| "USB serial".to_string());
                    match (&info.manufacturer, &info.serial_number) {
                        (Some(m), Some(s)) => format!("{m} {product} ({s})"),
                        (Some(m), None) => format!("{m} {product}"),
                        _ => product,
                    }
                }
                _ => "Serial device".to_string(),
            };
            SerialPortEntry { path: p.port_name, label }
        })
        .collect())
}
