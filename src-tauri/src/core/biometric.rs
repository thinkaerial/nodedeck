/// Touch ID unlock, macOS only. Not implemented on Windows — the app falls
/// back to password-only unlock there (see commands/auth.rs).
#[cfg(target_os = "macos")]
mod mac {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2_foundation::{NSError, NSString};
    use objc2_local_authentication::{LAContext, LAPolicy};
    use std::sync::Mutex;

    pub async fn authenticate(reason: String) -> anyhow::Result<bool> {
        let (tx, rx) = tokio::sync::oneshot::channel::<bool>();

        tokio::task::spawn_blocking(move || unsafe {
            let context: Retained<LAContext> = LAContext::new();
            let ns_reason = NSString::from_str(&reason);
            let context_keep_alive = context.clone();
            let tx_holder = Mutex::new(Some(tx));

            let block = RcBlock::new(move |success: objc2::runtime::Bool, _error: *mut NSError| {
                let _keep_alive = &context_keep_alive;
                if let Some(sender) = tx_holder.lock().unwrap().take() {
                    let _ = sender.send(success.as_bool());
                }
            });

            context.evaluatePolicy_localizedReason_reply(
                LAPolicy::DeviceOwnerAuthenticationWithBiometrics,
                &ns_reason,
                &block,
            );
        });

        Ok(rx.await.unwrap_or(false))
    }

    pub fn is_available() -> bool {
        unsafe {
            let context: Retained<LAContext> = LAContext::new();
            context
                .canEvaluatePolicy_error(LAPolicy::DeviceOwnerAuthenticationWithBiometrics)
                .is_ok()
        }
    }
}

#[cfg(target_os = "macos")]
pub use mac::{authenticate, is_available};

#[cfg(not(target_os = "macos"))]
pub async fn authenticate(_reason: String) -> anyhow::Result<bool> {
    Ok(false)
}

#[cfg(not(target_os = "macos"))]
pub fn is_available() -> bool {
    false
}
