import { invoke } from "@tauri-apps/api/core";

export const accountExists = (): Promise<boolean> => invoke("auth_account_exists");
export const listUsernames = (): Promise<string[]> => invoke("auth_list_usernames");
export const createAccount = (username: string, password: string): Promise<void> =>
  invoke("auth_create_account", { username, password });
export const verifyPassword = (username: string, password: string): Promise<boolean> =>
  invoke("auth_verify_password", { username, password });
export const currentUser = (): Promise<string | null> => invoke("auth_current_user");
export const logout = (): Promise<void> => invoke("auth_logout");
export const biometricAvailable = (): Promise<boolean> => invoke("auth_biometric_available");
export const biometricUnlock = (username: string, reason: string): Promise<boolean> =>
  invoke("auth_biometric_unlock", { username, reason });
