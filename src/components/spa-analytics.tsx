import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { startAnalyticsSession } from "@/lib/analytics";

/**
 * Vite SPA page views: passing `route` + `path` disables auto-track and
 * reports each client-side navigation (/demo, /pricing, /signin, /feed).
 */
export default function SpaAnalytics() {
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;

  useEffect(() => {
    startAnalyticsSession();
  }, []);

  return (
    <>
      <Analytics framework="vite" route={location.pathname} path={path} />
      <SpeedInsights route={location.pathname} />
    </>
  );
}
