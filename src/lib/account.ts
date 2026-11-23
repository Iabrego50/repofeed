import { jsonAuthHeaders } from "./api/bearer";

/** Permanently delete the signed-in account via the secure server endpoint. */
export async function deleteAccount(): Promise<void> {
  const response = await fetch("/api/account/delete", {
    method: "POST",
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || response.statusText || "Could not delete account");
  }
}
