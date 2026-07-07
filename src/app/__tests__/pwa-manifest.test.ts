import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// The manifest is a static file in public/ (linked from the root layout via
// metadata.manifest) rather than app/manifest.ts, so its hex color literals
// stay outside the src design-token lint rules. process.cwd() is the repo
// root when vitest runs.
const publicDir = path.resolve(process.cwd(), "public");
const manifestPath = path.join(publicDir, "manifest.webmanifest");

type ManifestIcon = { src: string; sizes: string; type: string; purpose?: string };

describe("PWA manifest", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    name: string;
    short_name: string;
    description: string;
    start_url: string;
    display: string;
    background_color: string;
    theme_color: string;
    icons: ManifestIcon[];
  };

  it("has the required install fields", () => {
    expect(manifest.name).toBe("RosterHouse");
    expect(manifest.short_name).toBe("RosterHouse");
    expect(manifest.description.length).toBeGreaterThan(0);
    expect(manifest.start_url).toBe("/shifts");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("declares installable icon sizes and every icon file exists", () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(
      manifest.icons.some((icon) => icon.purpose === "maskable")
    ).toBe(true);
    for (const icon of manifest.icons) {
      expect(existsSync(path.join(publicDir, icon.src)), `${icon.src} missing`).toBe(true);
    }
  });

  it("is linked from the root layout", () => {
    const layout = readFileSync(
      path.resolve(process.cwd(), "src/app/layout.tsx"),
      "utf8"
    );
    expect(layout).toContain('manifest: "/manifest.webmanifest"');
  });
});

describe("service worker", () => {
  const sw = readFileSync(path.join(publicDir, "sw.js"), "utf8");

  it("keeps the push handlers that shipped with web push", () => {
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).toContain("showNotification(data.title, { body: data.body })");
    expect(sw).toContain('openWindow("/notifications")');
  });

  it("precaches the offline fallback and that route exists", () => {
    expect(sw).toContain('"/offline"');
    expect(
      existsSync(path.resolve(process.cwd(), "src/app/offline/page.tsx"))
    ).toBe(true);
  });
});
