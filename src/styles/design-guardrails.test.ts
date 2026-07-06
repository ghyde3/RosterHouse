import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Token files (src/styles/tokens/**) are exempt: hex lives there by design.
// process.cwd() is the repo root when vitest runs (no __dirname in ESM).
const CSS_ROOTS = [
  path.resolve(process.cwd(), "src/app"),
  path.resolve(process.cwd(), "src/components"),
];

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;
// font-family declarations must reference the token variables
const BAD_FONT_FAMILY = /font-family\s*:(?![^;]*var\(--font-(?:sans|mono)\))/;

function cssFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...cssFilesUnder(full));
    else if (full.endsWith(".css")) out.push(full);
  }
  return out;
}

describe("design guardrails (CSS)", () => {
  const files = CSS_ROOTS.flatMap(cssFilesUnder);

  it("finds css files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("uses no raw hex colors outside the token files", () => {
    const offenders = files.filter((f) =>
      HEX_COLOR.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("sets font-family only via the design token variables", () => {
    const offenders = files.filter((f) =>
      BAD_FONT_FAMILY.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
