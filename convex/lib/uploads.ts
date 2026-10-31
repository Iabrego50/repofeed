import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// New uploads are saved right after they finish; older files can't be claimed,
// so files that predate ownership tracking can't be taken over.
const FRESH_MS = 60 * 60 * 1000;

async function findClaim(ctx: MutationCtx, storageId: Id<"_storage">) {
  return await ctx.db
    .query("uploadClaims")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .unique();
}

type UploadMeta = { _creationTime: number; size: number; contentType?: string };

/** Ties a just-uploaded file to a workspace. Each file can be claimed once. */
export async function claimUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  workspaceId: Id<"workspaces">,
): Promise<UploadMeta> {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (!meta) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Upload not found. Try again." });
  }
  if ((await findClaim(ctx, storageId)) || Date.now() - meta._creationTime > FRESH_MS) {
    throw new ConvexError({ code: "FORBIDDEN", message: "That upload can't be used. Upload the file again." });
  }
  await ctx.db.insert("uploadClaims", { storageId, workspaceId });
  return meta;
}

/** Deletes a file, but never one that belongs to a different workspace. */
export async function deleteUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  workspaceId: Id<"workspaces">,
): Promise<void> {
  const claim = await findClaim(ctx, storageId);
  if (claim && claim.workspaceId !== workspaceId) return;
  if (claim) await ctx.db.delete("uploadClaims", claim._id);
  await ctx.storage.delete(storageId);
}
