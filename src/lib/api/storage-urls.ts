/** Public bucket for AI reel backdrops. Share pages load these without login. */
export const ART_BUCKET = "art";

/** Private buckets. Never use getPublicUrl / /object/public for these. */
export const PRIVATE_MEDIA_BUCKETS = ["uploads", "footage", "generated"] as const;

export type ArtBucket = typeof ART_BUCKET;

export type PaintedMedia = {
  url: string;
  storageId: string;
  bucket: ArtBucket;
  caption: string;
  media: "image";
};

export function artStoragePath(reelId: string, at = Date.now()): string {
  return `${reelId}/${at}.png`;
}

export function publicStorageOrigin(
  env: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env,
): string {
  const fromEnv = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    const fromVite = String(import.meta.env?.VITE_SUPABASE_URL ?? "").trim();
    if (fromVite) return fromVite.replace(/\/$/, "");
  } catch {
    // import.meta.env is absent outside Vite
  }
  return "";
}

export function publicObjectUrl(origin: string, bucket: string, objectPath: string): string {
  const base = origin.replace(/\/$/, "");
  const encoded = objectPath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

export function parseStoragePublicUrl(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/?]+)\/([^?]+)/);
  if (!match?.[1] || !match[2]) return null;
  return {
    bucket: decodeURIComponent(match[1]),
    path: match[2]
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/"),
  };
}

export function isPrivateBucketPublicUrl(url: string): boolean {
  const parsed = parseStoragePublicUrl(url);
  return !!parsed && (PRIVATE_MEDIA_BUCKETS as readonly string[]).includes(parsed.bucket);
}

export function paintedArtFields(args: {
  origin: string;
  storageId: string;
  caption: string;
}): { footage: PaintedMedia; art: { status: "completed"; url: string; storageId: string; bucket: ArtBucket; caption: string } } {
  const url = publicObjectUrl(args.origin, ART_BUCKET, args.storageId);
  const footage: PaintedMedia = {
    url,
    storageId: args.storageId,
    bucket: ART_BUCKET,
    caption: args.caption,
    media: "image",
  };
  return {
    footage,
    art: {
      status: "completed",
      url,
      storageId: args.storageId,
      bucket: ART_BUCKET,
      caption: args.caption,
    },
  };
}

type FootageLike = {
  url?: string;
  storageId?: string;
  bucket?: string;
  caption?: string;
  media?: string;
} | null | undefined;

/** Rebuild a public art URL from the stored path. Leave stock clips and private media alone. */
export function hydrateFootageMedia<T extends FootageLike>(footage: T, origin: string): T {
  if (!footage || typeof footage !== "object") return footage;
  if (footage.url?.startsWith("/")) return footage;

  const parsed = footage.url ? parseStoragePublicUrl(footage.url) : null;
  const bucket = footage.bucket || (parsed?.bucket === ART_BUCKET ? ART_BUCKET : undefined);
  const storageId = footage.storageId || (bucket === ART_BUCKET ? parsed?.path : undefined);

  if (bucket === ART_BUCKET && storageId && origin) {
    return {
      ...footage,
      url: publicObjectUrl(origin, ART_BUCKET, storageId),
      storageId,
      bucket: ART_BUCKET,
    };
  }

  return footage;
}
