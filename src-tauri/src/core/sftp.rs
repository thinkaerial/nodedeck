use anyhow::Result;
use russh_sftp::client::SftpSession;
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use super::ssh::ConnectionParams;
use super::ssh_pool::SshPool;

#[derive(Debug, Clone, Serialize)]
pub struct SftpEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

async fn open_sftp(pool: &SshPool, params: &ConnectionParams) -> Result<SftpSession> {
    let channel = pool.open_channel(params).await?;
    channel.request_subsystem(true, "sftp").await?;
    Ok(SftpSession::new(channel.into_stream()).await?)
}

/// Lists a remote directory over SFTP, reusing the device's pooled SSH
/// connection (opens a fresh channel + sftp subsystem, not a fresh TCP+SSH
/// handshake).
pub async fn list_dir(pool: &SshPool, params: &ConnectionParams, path: &str) -> Result<Vec<SftpEntry>> {
    let sftp = open_sftp(pool, params).await?;

    let entries = sftp
        .read_dir(path)
        .await?
        .map(|entry| {
            let meta = entry.metadata();
            SftpEntry {
                name: entry.file_name(),
                is_dir: meta.is_dir(),
                size: meta.size,
            }
        })
        .collect();

    sftp.close().await.ok();
    Ok(entries)
}

const COPY_CHUNK: usize = 128 * 1024;

/// Streams a local file to a remote path — reads/writes in fixed-size chunks,
/// never buffering the whole file in RAM, so a multi-GB transfer costs
/// COPY_CHUNK bytes of memory, not file-size bytes. `on_progress(sent, total)`
/// is called after each chunk.
pub async fn upload_file(
    pool: &SshPool,
    params: &ConnectionParams,
    local_path: &str,
    remote_path: &str,
    mut on_progress: impl FnMut(u64, u64) + Send,
) -> Result<()> {
    let sftp = open_sftp(pool, params).await?;

    let mut local = tokio::fs::File::open(local_path).await?;
    let total = local.metadata().await?.len();
    let mut remote = sftp.create(remote_path).await?;

    let mut buf = vec![0u8; COPY_CHUNK];
    let mut sent = 0u64;
    loop {
        let n = local.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        remote.write_all(&buf[..n]).await?;
        sent += n as u64;
        on_progress(sent, total);
    }
    remote.flush().await.ok();
    remote.shutdown().await.ok();
    sftp.close().await.ok();
    Ok(())
}

/// Streams a remote file to a local path — same chunked, constant-memory
/// approach as `upload_file`.
pub async fn download_file(
    pool: &SshPool,
    params: &ConnectionParams,
    remote_path: &str,
    local_path: &str,
    mut on_progress: impl FnMut(u64, u64) + Send,
) -> Result<()> {
    let sftp = open_sftp(pool, params).await?;

    let metadata = sftp.metadata(remote_path).await?;
    let total = metadata.size.unwrap_or(0);
    let mut remote = sftp.open(remote_path).await?;
    let mut local = tokio::fs::File::create(local_path).await?;

    let mut buf = vec![0u8; COPY_CHUNK];
    let mut received = 0u64;
    loop {
        let n = remote.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        local.write_all(&buf[..n]).await?;
        received += n as u64;
        on_progress(received, total);
    }
    local.flush().await.ok();
    sftp.close().await.ok();
    Ok(())
}
