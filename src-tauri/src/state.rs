use std::collections::HashMap;
use std::sync::Mutex;

use tokio::sync::mpsc::UnboundedSender;

pub enum PtyInput {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

pub struct PtyHandle {
    pub input_tx: UnboundedSender<PtyInput>,
}

#[derive(Default)]
pub struct PtyRegistry(pub Mutex<HashMap<String, PtyHandle>>);

pub enum SerialInput {
    Data(Vec<u8>),
    Close,
}

pub struct SerialHandle {
    pub input_tx: std::sync::mpsc::Sender<SerialInput>,
}

#[derive(Default)]
pub struct SerialRegistry(pub Mutex<HashMap<String, SerialHandle>>);

/// The logged-in account for this app session. Every device/group/task/audit
/// query is scoped to this username so each account has its own fully
/// separate setup — not a shared pool everyone sees.
#[derive(Default)]
pub struct AppSession(pub Mutex<Option<String>>);

impl AppSession {
    pub fn current_user(&self) -> Result<String, String> {
        self.0
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| "not logged in".to_string())
    }
}
