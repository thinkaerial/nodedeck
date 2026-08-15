import { Cpu, HardDrive, MonitorSmartphone, CircuitBoard, Radio, HelpCircle } from "lucide-react";
import type { DeviceType } from "../mocks/types";

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  raspberry_pi: "Raspberry Pi",
  jetson: "Jetson",
  radxa: "Radxa",
  luckfox: "Luckfox",
  linux_pc: "Linux PC",
  windows_pc: "Windows PC",
  unknown: "Unknown",
};

export const DEVICE_TYPE_ICON: Record<DeviceType, typeof Cpu> = {
  raspberry_pi: CircuitBoard,
  jetson: Cpu,
  radxa: CircuitBoard,
  luckfox: Radio,
  linux_pc: HardDrive,
  windows_pc: MonitorSmartphone,
  unknown: HelpCircle,
};
