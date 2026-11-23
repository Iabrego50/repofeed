import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativePlatform, pathFromAppUrl } from "@/lib/native";

/**
 * Native shell bootstrap: status bar, splash hide, keyboard, safe-area class,
 * pinch-zoom lock, and deep-link routing for Supabase auth redirects.
 * No-op on web.
 */
export function useNativeApp() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativePlatform()) return;

    const root = document.documentElement;
    root.classList.add("native-app");
    if (Capacitor.getPlatform() === "ios") {
      root.classList.add("native-ios");
    }

    // Lock pinch-zoom in the WebView without changing the web viewport meta.
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
      );
    }

    void (async () => {
      try {
        await StatusBar.setStyle({ style: Style.Light });
      } catch {
        /* plugin may be unavailable in some simulators */
      }
      try {
        await SplashScreen.hide();
      } catch {
        /* ignore */
      }
    })();

    const keyboardShow = Keyboard.addListener("keyboardWillShow", () => {
      root.classList.add("keyboard-open");
    });
    const keyboardHide = Keyboard.addListener("keyboardWillHide", () => {
      root.classList.remove("keyboard-open");
    });

    const urlOpen = CapApp.addListener("appUrlOpen", ({ url }) => {
      void Browser.close().catch(() => undefined);
      const path = pathFromAppUrl(url);
      if (path) {
        navigate(path, { replace: true });
      }
    });

    // Third-party http(s) links → SFSafariViewController; same-site paths stay in the SPA.
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("/") || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      if (!/^https?:/i.test(href)) return;
      try {
        const next = new URL(href);
        if (next.hostname === "repofeed.ai" || next.hostname.endsWith(".repofeed.ai")) {
          event.preventDefault();
          navigate(`${next.pathname}${next.search}${next.hash}`);
          return;
        }
      } catch {
        return;
      }
      event.preventDefault();
      void Browser.open({ url: href });
    };
    document.addEventListener("click", onClick, true);

    return () => {
      root.classList.remove("native-app", "native-ios", "keyboard-open");
      document.removeEventListener("click", onClick, true);
      void keyboardShow.then((h) => h.remove());
      void keyboardHide.then((h) => h.remove());
      void urlOpen.then((h) => h.remove());
    };
  }, [navigate]);
}
