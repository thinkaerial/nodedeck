import { useOutletContext } from "react-router-dom";
import type { Device } from "../mocks/types";
import type { ConnectionParams } from "../ipc/types";

export function useDevice() {
  return useOutletContext<{ device: Device; connection?: ConnectionParams }>().device;
}

export function useDeviceConnection() {
  return useOutletContext<{ device: Device; connection?: ConnectionParams }>().connection;
}
