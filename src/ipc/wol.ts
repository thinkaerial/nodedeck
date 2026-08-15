import { invoke } from "@tauri-apps/api/core";

export const sendMagicPacket = (macAddress: string): Promise<void> => invoke("wol_send", { macAddress });
