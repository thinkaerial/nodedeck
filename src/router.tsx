import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { DeviceLayout } from "./components/layout/DeviceLayout";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { DevicesScreen } from "./screens/devices/DevicesScreen";
import { DeviceOverviewScreen } from "./screens/device-detail/DeviceOverviewScreen";
import { NetworkScannerScreen } from "./screens/network-scanner/NetworkScannerScreen";
import { TerminalScreen } from "./screens/terminal/TerminalScreen";
import { FilesScreen } from "./screens/files/FilesScreen";
import { MonitorScreen } from "./screens/monitor/MonitorScreen";
import { ProcessesServicesScreen } from "./screens/processes-services/ProcessesServicesScreen";
import { LogsScreen } from "./screens/logs/LogsScreen";
import { SerialScreen } from "./screens/serial/SerialScreen";
import { NetworkToolsScreen } from "./screens/network-tools/NetworkToolsScreen";
import { SharesScreen } from "./screens/shares/SharesScreen";
import { TasksScreen } from "./screens/tasks/TasksScreen";
import { CredentialsSecurityScreen } from "./screens/credentials-security/CredentialsSecurityScreen";
import { SettingsScreen } from "./screens/settings/SettingsScreen";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <DashboardScreen /> },
      { path: "/scanner", element: <NetworkScannerScreen /> },
      { path: "/devices", element: <DevicesScreen /> },
      {
        path: "/devices/:deviceId",
        element: <DeviceLayout />,
        children: [
          { index: true, element: <DeviceOverviewScreen /> },
          { path: "terminal", element: <TerminalScreen /> },
          { path: "files", element: <FilesScreen /> },
          { path: "monitor", element: <MonitorScreen /> },
          { path: "processes", element: <ProcessesServicesScreen /> },
          { path: "logs", element: <LogsScreen /> },
          { path: "serial", element: <SerialScreen /> },
        ],
      },
      { path: "/network-tools", element: <NetworkToolsScreen /> },
      { path: "/shares", element: <SharesScreen /> },
      { path: "/tasks", element: <TasksScreen /> },
      { path: "/security", element: <CredentialsSecurityScreen /> },
      { path: "/settings", element: <SettingsScreen /> },
    ],
  },
]);
