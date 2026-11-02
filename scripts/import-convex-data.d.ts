export const TABLE_MAP: Record<string, string>;
export const SKIP_TABLES: Record<string, string>;
export const CONVEX_ID_NAMESPACE: string;
export const UNIQUE_KEYS: Record<string, string[]>;
export function uuidFromConvexId(convexId: string, namespace?: string): string;
export function folderFromDocumentsPath(name: string): string | null;
export function parseSnapshotTables(zip: { files: Record<string, { dir?: boolean; name: string }> }): Map<string, null>;
export function readZipLocalHeaders(buffer: Uint8Array | ArrayBuffer | Buffer): Map<string, Buffer>;
export function loadSnapshotTables(options: {
  zipPath?: string;
  zipBuffer?: Uint8Array | ArrayBuffer;
  zip?: unknown;
  snapshotDir?: string;
  recordsByFolder?: Map<string, object[]>;
  zipEngine?: "auto" | "jszip" | "local";
}): Promise<Map<string, object[]>>;
export function emailKey(email: string): string;
export function recordRecency(record: object): number;
export function dedupeUsersByEmail(records: object[]): Array<{
  winner: object;
  convexIds: string[];
  records: object[];
}>;
export function uniqueRowKey(table: string, row: object): string | null;
export function dedupeUniqueConstraintRows(
  table: string,
  rows: object[],
  log?: (msg: string) => void,
): object[];
export function planSnapshot(
  folderNames: string[],
  recordsByFolder: Map<string, object[]>,
  log: (msg: string) => void,
  options?: { ignoreUnderscoreFolders?: boolean },
): Array<{ folder: string; table: string | null; count: number; skip: string | null }>;
export function runImport(options: {
  zipPath?: string;
  zipBuffer?: Uint8Array | ArrayBuffer;
  zip?: unknown;
  snapshotDir?: string;
  recordsByFolder?: Map<string, object[]>;
  zipEngine?: "auto" | "jszip" | "local";
  supabase?: unknown;
  dryRun?: boolean;
  log?: (msg: string) => void;
  dedupeUsers?: boolean;
  dedupeUniqueKeys?: boolean;
  ignoreUnderscoreFolders?: boolean;
}): Promise<{ dryRun: boolean; counts: Record<string, number>; idMap: Map<string, string> }>;
export function runLegacyImport(options: {
  zipPath?: string;
  zipBuffer?: Uint8Array | ArrayBuffer;
  zip?: unknown;
  supabase?: unknown;
}): Promise<{ users: number; workspace_members: number }>;
export function isLaunchedAsMain(metaUrl?: string, argv1?: string): boolean;
export function isLaunchedAsMainLegacy(argv1?: string): boolean;
export function main(argv?: string[]): Promise<void>;
