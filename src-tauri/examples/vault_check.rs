//! Verifies the real OS keychain integration: set, get, delete a password
//! under a throwaway device id, and clean up after itself.
use app_lib::core::vault;

fn main() -> anyhow::Result<()> {
    let device_id = "nodedeck-vault-check-throwaway";

    println!("set_password...");
    vault::set_password(device_id, "correct horse battery staple")?;

    println!("get_password...");
    let got = vault::get_password(device_id)?;
    assert_eq!(got.as_deref(), Some("correct horse battery staple"));
    println!("got: {got:?}");

    println!("delete_password...");
    vault::delete_password(device_id)?;
    let after_delete = vault::get_password(device_id)?;
    assert_eq!(after_delete, None);
    println!("after delete: {after_delete:?}");

    println!("ALL CHECKS PASSED");
    Ok(())
}
