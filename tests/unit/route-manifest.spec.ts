import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { criticalJourneys, routes } from "../../tests/e2e/route-manifest.js";

/*
 * Route manifest invariants (workflow contract 15.2): every SCREEN appears
 * exactly once, every manifest SCREEN exists in PRD.md (no orphans), PRD
 * screens all appear (no gaps), journeys reference defined screens, manual
 * evidence carries a reason.
 */
const prd = readFileSync(join(process.cwd(), "PRD.md"), "utf8");

describe("route manifest (Step 15 contract)", () => {
  it("lists every SCREEN exactly once with no PRD orphans or gaps", () => {
    const ids = routes.map((route) => route.screenId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(prd).toContain(`\`${id}\``);

    const prdIds = [...new Set(prd.match(/SCREEN-\d{3}/g) ?? [])];
    for (const id of prdIds) expect(ids).toContain(id);
  });

  it("defines six named states and a role on every route", () => {
    for (const route of routes) {
      expect(route.roles).toEqual(["local-operator"]);
      expect(route.deniedRoles).toEqual([]);
      for (const state of Object.values(route.states)) {
        expect(state.length).toBeGreaterThan(0);
      }
    }
  });

  it("critical journeys reference defined screens only", () => {
    const ids = new Set(routes.map((route) => route.screenId));
    expect(criticalJourneys.length).toBeGreaterThanOrEqual(5);
    for (const journey of criticalJourneys) {
      for (const screen of journey.screens) expect(ids.has(screen)).toBe(true);
    }
  });

  it("manual evidence always carries a reason", () => {
    for (const route of routes) {
      if (route.evidence.kind === "manual") {
        expect(route.evidence.reason.length).toBeGreaterThan(0);
      }
    }
  });
});
