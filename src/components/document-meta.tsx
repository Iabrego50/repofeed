import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DEFAULT_ROUTE_META, metaForPath } from "@/lib/document-meta.ts";

function upsertMeta(selector: string, attributes: Record<string, string>, content: string) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

export default function DocumentMeta() {
  const { pathname } = useLocation();
  const meta = metaForPath(pathname);

  useEffect(() => {
    document.title = meta.title;
    upsertMeta('meta[name="description"]', { name: "description" }, meta.description);
    upsertMeta('meta[property="og:title"]', { property: "og:title" }, meta.title);
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, meta.title);
    upsertMeta('meta[property="og:description"]', { property: "og:description" }, meta.description);
    upsertMeta('meta[name="robots"]', { name: "robots" }, meta.robots ?? "index,follow");
  }, [meta.description, meta.robots, meta.title]);

  return null;
}

export { DEFAULT_ROUTE_META };
