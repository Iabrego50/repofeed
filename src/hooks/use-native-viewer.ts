import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { isNativePlatform } from "@/lib/native";
import { isNativeAdminAccess, isNativeViewerMode } from "@/lib/native-access";

/**
 * Loads `users.is_admin` (server-backed row) and derives native viewer vs admin shell.
 * On web, `nativeViewerMode` is always false so existing web UX is unchanged.
 */
export function useNativeViewer() {
  const native = isNativePlatform();
  const { data: profile, isLoading, isFetching } = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => api.users.current(),
    enabled: native,
  });

  const isAdmin = Boolean((profile as { is_admin?: boolean } | null | undefined)?.is_admin);
  const loading = native && (isLoading || (isFetching && profile === undefined));

  return {
    isAdmin,
    nativeViewerMode: isNativeViewerMode(isAdmin),
    nativeAdminAccess: isNativeAdminAccess(isAdmin),
    /** Wait before choosing viewer vs creator chrome on native. */
    loading,
    profile,
  };
}
