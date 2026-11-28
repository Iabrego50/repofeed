import { Navigate } from "react-router-dom";

/**
 * Legacy “About you / Your workspace / Your team / First study” setup.
 * Deep links to /welcome?setup=1 now resume the Slopstrap build-your-channel flow.
 */
export default function WorkspaceSetup() {
  return <Navigate to="/welcome?setup=1" replace />;
}
