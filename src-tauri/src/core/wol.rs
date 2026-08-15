use anyhow::{bail, Result};
use std::net::UdpSocket;

/// Sends a standard Wake-on-LAN magic packet (6 bytes of 0xFF followed by the
/// target MAC repeated 16 times) as a UDP broadcast on port 9. The device
/// must have WoL enabled in its own OS/BIOS — this only sends the packet.
pub fn send_magic_packet(mac_address: &str) -> Result<()> {
    let mac = parse_mac(mac_address)?;

    let mut packet = vec![0xFFu8; 6];
    for _ in 0..16 {
        packet.extend_from_slice(&mac);
    }

    let socket = UdpSocket::bind("0.0.0.0:0")?;
    socket.set_broadcast(true)?;
    socket.send_to(&packet, "255.255.255.255:9")?;
    Ok(())
}

fn parse_mac(mac: &str) -> Result<[u8; 6]> {
    let cleaned: Vec<&str> = mac.split(|c| c == ':' || c == '-').collect();
    if cleaned.len() != 6 {
        bail!("invalid MAC address: {mac}");
    }
    let mut bytes = [0u8; 6];
    for (i, part) in cleaned.iter().enumerate() {
        bytes[i] = u8::from_str_radix(part, 16).map_err(|_| anyhow::anyhow!("invalid MAC address: {mac}"))?;
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_colon_separated_mac() {
        assert_eq!(parse_mac("b8:27:eb:d3:63:a1").unwrap(), [0xb8, 0x27, 0xeb, 0xd3, 0x63, 0xa1]);
    }

    #[test]
    fn parses_dash_separated_mac() {
        assert_eq!(parse_mac("B8-27-EB-D3-63-A1").unwrap(), [0xb8, 0x27, 0xeb, 0xd3, 0x63, 0xa1]);
    }

    #[test]
    fn rejects_malformed_mac() {
        assert!(parse_mac("not-a-mac").is_err());
        assert!(parse_mac("b8:27:eb").is_err());
    }
}
