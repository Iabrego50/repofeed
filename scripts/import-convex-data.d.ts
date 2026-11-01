export const TABLE_MAP: Record<string, string>;
export const SKIP_TABLES: Record<string, string>;
export const CONVEX_ID_NAMESPACE: string;
export function uuidFromConvexId(convexId: string, namespace?: string): string;
export function parseSnapshotTables(zip: { files: Record<string, { dir?: boolean; name: string }> }): Map<string, null>;
export function runImport(options: {
  zipPath?: string;
  zipBuffer?: Uint8Array | ArrayBuffer;
  zip?: unknown;
  supabase?: unknown;
  dryRun?: boolean;
  log?: (msg: string) => void;
}): Promise<{ dryRun: boolean; counts: Record<string, number>; idMap: Map<string, string> }>;
export function runLegacyImport(options: {
  zipPath?: string;
  zipBuffer?: Uint8Array | ArrayBuffer;
  zip?: unknown;
  supabase?: unknown;
}): Promise<{ users: number; workspace_members: number }>;
export function main(argv?: string[]): Promise<void>;
