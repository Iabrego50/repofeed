import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { isNativePlatform } from "./native";

/** Light haptic feedback on native; no-op on web. */
export async function lightImpact(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* optional */
  }
}
