import type { MetadataRoute } from "next";
import { NAV, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return NAV.map((n) => ({ url: `${SITE_URL}${n.href === "/" ? "" : n.href}`, lastModified: new Date() }));
}
