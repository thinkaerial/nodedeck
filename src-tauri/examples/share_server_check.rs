//! Verifies the share HTTP server end-to-end: create a share for a real local
//! file, serve it, and fetch it back via plain HTTP — proving token auth,
//! password gate, and streaming actually work together.

use app_lib::core::{share_server, sharing};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let tmp = std::env::temp_dir().join("nodedeck_share_check.txt");
    std::fs::write(&tmp, b"hello from nodedeck share server\n")?;

    let registry = sharing::new_registry();
    let port = 47899u16;
    tokio::spawn(share_server::run(registry.clone(), port));
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    let record = sharing::create_share(
        &registry,
        tmp.to_string_lossy().to_string(),
        Some("secret123".to_string()),
        Some(60),
        Some(2),
    )
    .await?;
    println!("created share token={}", record.token);

    let client = reqwest::Client::new();
    let base = format!("http://127.0.0.1:{port}/s/{}", record.token);

    let no_pw = client.get(&base).send().await?;
    println!("no password -> {}", no_pw.status());
    assert_eq!(no_pw.status(), 401);

    let wrong_pw = client.get(format!("{base}?password=wrong")).send().await?;
    println!("wrong password -> {}", wrong_pw.status());
    assert_eq!(wrong_pw.status(), 401);

    let ok = client.get(format!("{base}?password=secret123")).send().await?;
    println!("correct password -> {}", ok.status());
    let body = ok.text().await?;
    println!("body: {body:?}");
    assert!(body.contains("hello from nodedeck"));

    let shares = sharing::list_shares(&registry).await;
    println!("download_count after 1 fetch = {}", shares[0].download_count);
    assert_eq!(shares[0].download_count, 1);

    sharing::revoke_share(&registry, &record.id).await?;
    let after_revoke = client.get(format!("{base}?password=secret123")).send().await?;
    println!("after revoke -> {}", after_revoke.status());
    assert_eq!(after_revoke.status(), 410);

    std::fs::remove_file(&tmp).ok();
    println!("ALL CHECKS PASSED");
    Ok(())
}
