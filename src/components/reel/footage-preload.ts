/** Whether the hidden footage <video> should mount and hit the network. */
export function shouldAttachReelFootage(
  hasPlayed: boolean,
  preload: "none" | "metadata" | "auto" = "metadata",
): boolean {
  return hasPlayed || preload !== "none";
}
