use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use russh::{client, Channel};
use tokio::sync::Mutex;

use super::ssh::{self, ConnectionParams, HostKeyVerifyingHandler};

type Handle = client::Handle<HostKeyVerifyingHandler>;

#[derive(Default, Clone)]
pub struct SshPool(Arc<Mutex<HashMap<String, Arc<Mutex<Handle>>>>>);

fn pool_key(params: &ConnectionParams) -> String {
    format!("{}@{}:{}", params.username, params.host, params.port)
}

impl SshPool {
    /// Returns a shared, already-authenticated connection for these params,
    /// reconnecting only if there is no cached connection yet. This is what
    /// makes repeated actions (terminal, file listing, monitor polls) fast —
    /// they pay the SSH handshake cost once per device, not once per action.
    async fn get_or_connect(&self, params: &ConnectionParams) -> Result<Arc<Mutex<Handle>>> {
        let key = pool_key(params);
        {
            let map = self.0.lock().await;
            if let Some(handle) = map.get(&key) {
                return Ok(handle.clone());
            }
        }
        let session = ssh::connect(params).await?;
        let handle = Arc::new(Mutex::new(session));
        self.0.lock().await.insert(key, handle.clone());
        Ok(handle)
    }

    async fn evict(&self, params: &ConnectionParams) {
        self.0.lock().await.remove(&pool_key(params));
    }

    /// Opens a new channel on the pooled connection for this device. Channels
    /// are cheap and independent once opened (SSH multiplexes many channels
    /// over one connection), so this is safe to call concurrently for a
    /// long-lived PTY channel alongside short-lived exec/SFTP channels on the
    /// same device — only the brief `channel_open_session` call is serialized.
    pub async fn open_channel(&self, params: &ConnectionParams) -> Result<Channel<client::Msg>> {
        let handle = self.get_or_connect(params).await?;
        {
            let guard = handle.lock().await;
            if let Ok(channel) = guard.channel_open_session().await {
                return Ok(channel);
            }
        }
        // Cached connection appears dead — drop it and retry once with a fresh one.
        self.evict(params).await;
        let handle = self.get_or_connect(params).await?;
        let guard = handle.lock().await;
        Ok(guard.channel_open_session().await?)
    }
}
