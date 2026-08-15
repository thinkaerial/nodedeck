use axum::{
    extract::{Path, Query, State},
    http::{Request, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde::Deserialize;
use tower::ServiceExt;
use tower_http::services::ServeFile;

use super::sharing::{ShareAccessEntry, ShareRegistry};

#[derive(Deserialize)]
struct AccessQuery {
    password: Option<String>,
}

async fn serve_share(
    State(registry): State<ShareRegistry>,
    Path(token): Path<String>,
    Query(query): Query<AccessQuery>,
    request: Request<axum::body::Body>,
) -> Response {
    let (path, needs_log) = {
        let mut guard = registry.lock().await;
        let Some(record) = guard.get_mut(&token) else {
            return (StatusCode::NOT_FOUND, "share not found").into_response();
        };

        if record.revoked {
            return (StatusCode::GONE, "share revoked").into_response();
        }
        if let Some(expires_at) = record.expires_at {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            if now > expires_at {
                return (StatusCode::GONE, "share expired").into_response();
            }
        }
        if let Some(limit) = record.download_limit {
            if record.download_count >= limit {
                return (StatusCode::GONE, "download limit reached").into_response();
            }
        }
        if let Some(expected) = &record.password {
            if query.password.as_deref() != Some(expected.as_str()) {
                return (StatusCode::UNAUTHORIZED, "password required or incorrect").into_response();
            }
        }

        (record.source_path.clone(), true)
    };

    let serve = ServeFile::new(&path);
    let response = match serve.oneshot(request).await {
        Ok(res) => res.into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "read error").into_response(),
    };

    if needs_log && response.status().is_success() {
        let mut guard = registry.lock().await;
        if let Some(record) = guard.get_mut(&token) {
            record.download_count += 1;
            record.access_log.push(ShareAccessEntry {
                at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            });
        }
    }

    response
}

pub async fn run(registry: ShareRegistry, port: u16) {
    let app = Router::new()
        .route("/s/:token", get(serve_share))
        .with_state(registry);

    let listener = match tokio::net::TcpListener::bind(("0.0.0.0", port)).await {
        Ok(l) => l,
        Err(e) => {
            log::error!("share server failed to bind port {port}: {e}");
            return;
        }
    };
    log::info!("share server listening on 0.0.0.0:{port}");
    if let Err(e) = axum::serve(listener, app).await {
        log::error!("share server error: {e}");
    }
}
