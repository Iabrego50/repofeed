// Demo insights - temporary stub
import { demoReels, demoFindings } from './demo-data';

export function getDemoInsights() {
  return {
    reels: demoReels,
    findings: demoFindings,
  };
}

export function searchDemoReels(query: string) {
  return demoReels.filter((reel: any) =>
    reel.title?.toLowerCase().includes(query.toLowerCase())
  );
}
