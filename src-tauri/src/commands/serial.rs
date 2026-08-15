use std::io::{ErrorKind, Read, Write};
use std::time::Duration;

use serde::Serialize;
use serialport::{DataBits, FlowControl, Parity, StopBits};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::core::serial::{self, SerialPortEntry};
use crate::state::{SerialHandle, SerialInput, SerialRegistry};

#[tauri::command]
pub fn serial_list_ports() -> Result<Vec<SerialPortEntry>, String> {
    serial::list_ports().map_err(|e| e.to_string())
}

#[derive(Clone, Serialize)]
struct SerialDataPayload<'a> {
    session_id: &'a str,
    data: String,
}

#[derive(Clone, Serialize)]
struct SerialEventPayload<'a> {
    session_id: &'a str,
}

fn parse_parity(s: &str) -> Parity {
    match s {
        "even" => Parity::Even,
        "odd" => Parity::Odd,
        _ => Parity::None,
    }
}

fn parse_stop_bits(s: &str) -> StopBits {
    if s == "2" {
        StopBits::Two
    } else {
        StopBits::One
    }
}

fn parse_flow_control(s: &str) -> FlowControl {
    match s {
        "rtscts" => FlowControl::Hardware,
        "xonxoff" => FlowControl::Software,
        _ => FlowControl::None,
    }
}

/// Opens a USB-serial port and streams it as `serial:data` events, mirroring
/// the SSH PTY pattern in commands/ssh.rs but backed by a plain OS thread
/// (the `serialport` crate is blocking, std::io, not tokio) instead of an
/// async task.
#[tauri::command]
pub fn serial_open(
    app: AppHandle,
    registry: State<'_, SerialRegistry>,
    path: String,
    baud_rate: u32,
    parity: String,
    stop_bits: String,
    flow_control: String,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    let (input_tx, input_rx) = std::sync::mpsc::channel::<SerialInput>();

    registry
        .0
        .lock()
        .unwrap()
        .insert(session_id.clone(), SerialHandle { input_tx });

    let sid = session_id.clone();
    let app_handle = app.clone();

    let mut port = match serialport::new(&path, baud_rate)
        .data_bits(DataBits::Eight)
        .parity(parse_parity(&parity))
        .stop_bits(parse_stop_bits(&stop_bits))
        .flow_control(parse_flow_control(&flow_control))
        .timeout(Duration::from_millis(50))
        .open()
    {
        Ok(p) => p,
        Err(e) => return Err(format!("failed to open {path}: {e}")),
    };

    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        loop {
            match input_rx.try_recv() {
                Ok(SerialInput::Data(bytes)) => {
                    let _ = port.write_all(&bytes);
                }
                Ok(SerialInput::Close) => break,
                Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
                Err(std::sync::mpsc::TryRecvError::Empty) => {}
            }

            match port.read(&mut buf) {
                Ok(0) => {}
                Ok(n) => {
                    let _ = app_handle.emit(
                        "serial:data",
                        SerialDataPayload {
                            session_id: &sid,
                            data: String::from_utf8_lossy(&buf[..n]).to_string(),
                        },
                    );
                }
                Err(e) if e.kind() == ErrorKind::TimedOut => {}
                Err(_) => break,
            }
        }

        let _ = app_handle.emit("serial:closed", SerialEventPayload { session_id: &sid });
        if let Some(registry) = app_handle.try_state::<SerialRegistry>() {
            registry.0.lock().unwrap().remove(&sid);
        }
    });

    Ok(session_id)
}

#[tauri::command]
pub fn serial_write(registry: State<'_, SerialRegistry>, session_id: String, data: String) -> Result<(), String> {
    let reg = registry.0.lock().unwrap();
    if let Some(handle) = reg.get(&session_id) {
        handle
            .input_tx
            .send(SerialInput::Data(data.into_bytes()))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn serial_close(registry: State<'_, SerialRegistry>, session_id: String) -> Result<(), String> {
    let mut reg = registry.0.lock().unwrap();
    if let Some(handle) = reg.remove(&session_id) {
        let _ = handle.input_tx.send(SerialInput::Close);
    }
    Ok(())
}
