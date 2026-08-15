import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthGate } from "./components/auth/AuthGate";

export default function App() {
  return (
    <AuthGate>
      <RouterProvider router={router} />
    </AuthGate>
  );
}
