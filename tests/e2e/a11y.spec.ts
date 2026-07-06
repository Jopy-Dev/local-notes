import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { ConfigService } from "../../src/backend/config/config-service.js";
import { EventBus } from "../../src/backend/events/event-bus.js";
import { OperationRegistry } from "../../src/backend/events/operation-registry.js";
import { NoteContentService } from "../../src/backend/filesystem/note-content.js";
import { NoteMutationService } from "../../src/backend/filesystem/note-mutations.js";
import { NoteRepository } from "../../src/backend/filesystem/note-repository.js";
import { WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";
import { initWorkspace } from "../../src/backend/filesystem/workspace-init.js";
import { MarkdownRenderService } from "../../src/backend/markdown/render-service.js";
import { createSearchService } from "../../src/backend/search/create-search-service.js";
import { generateCapability } from "../../src/backend/security/index.js";
import { startServer } from "../../src/backend/server.js";
import { ensureClientBuilt } from "../integration/dist-build.js";

/*
 * REQ-030 / METRIC-005 automated sweep: axe (WCAG 2.1 AA rule set) against
 * the packaged SPA shell on the real server for SCREEN-001/002/003/007 at
 * the three supported viewports - zero serious/critical violations - plus a
 * keyboard-operability smoke on the core open-note path. Full keyboard
 * acceptance and cross-browser runs land at Step 15. Evidence: .qa/a11y/.
 */
const SETUP_TIMEOUT_MS = 300_000;
const BASE = "http://127.0.0.1:8989";
const VIEWPORTS = [
  { width: 1024, height: 640 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
] as const;

let root: string;
let capability: string;
let app: FastifyInstance;
let browser: Browser;
let noteKey: string;

beforeAll(async () => {
  const staticRoot = ensureClientBuilt();
  root = mkdtempSync(join(tmpdir(), "ln-a11y-"));
  await initWorkspace(root);
  const notesDir = join(root, "save-data", "notes");
  mkdirSync(join(notesDir, "projects"), { recursive: true });
  writeFileSync(
    join(notesDir, "welcome.md"),
    "# Welcome\n\nSome **welcome** content with a [link](https://example.com) and `code`.\n",
  );
  writeFileSync(join(notesDir, "projects", "plan.md"), "# Plan\n\n- [ ] first task\n");
  noteKey = Buffer.from("welcome.md").toString("base64url");

  capability = generateCapability();
  const guard = await WorkspacePathGuard.create(root);
  const repository = new NoteRepository(guard, "save-data/notes");
  const bus = new EventBus();
  const configService = new ConfigService(root);
  await configService.load();
  const { service: searchService } = createSearchService({
    guard,
    workspaceRoot: root,
    notesRelRoot: "save-data/notes",
    bus,
    preferredEngine: "in-process",
  });
  await searchService.initialize(await repository.scan());

  app = await buildApp({
    capability,
    staticRoot,
    workspaceRoot: root,
    configService,
    noteRepository: repository,
    eventBus: bus,
    searchService,
    mutationService: new NoteMutationService(guard),
    contentService: new NoteContentService(guard),
    markdownService: new MarkdownRenderService(guard),
    operationRegistry: new OperationRegistry(),
  });
  await startServer(app);
  browser = await chromium.launch();
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  await browser?.close();
  await app?.close();
  rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

interface ScreenTarget {
  screenId: string;
  path: string;
  readySelector: string;
}

const SCREENS: ScreenTarget[] = [
  { screenId: "SCREEN-001", path: "/", readySelector: "#note-search" },
  // Source mode is the single editing surface (round 2). Path set from
  // noteKey at runtime.
  { screenId: "SCREEN-002", path: "", readySelector: ".cm-content" },
  { screenId: "SCREEN-003", path: "/settings", readySelector: "#settings-form" },
  { screenId: "SCREEN-007", path: "/recovery/search", readySelector: "main, h1, h2" },
];

async function openScreen(page: Page, path: string, readySelector: string): Promise<void> {
  // The #access fragment bootstraps the capability into sessionStorage on
  // every full load (services/token.ts), so each goto stays authenticated.
  await page.goto(`${BASE}${path}#access=${capability}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(readySelector, { timeout: 15_000 });
}

interface ViolationRecord {
  screenId: string;
  viewport: string;
  id: string;
  impact: string;
  nodes: number;
  targets: string[];
  help: string;
}

describe("REQ-030 accessibility sweep (axe, three viewports)", () => {
  it("has zero serious/critical violations across core screens", async () => {
    const all: ViolationRecord[] = [];
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { ...viewport } });
      const page = await context.newPage();
      for (const screen of SCREENS) {
        const path = screen.screenId === "SCREEN-002" ? `/notes/${noteKey}` : screen.path;
        await openScreen(page, path, screen.readySelector);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        for (const violation of results.violations) {
          all.push({
            screenId: screen.screenId,
            viewport: `${viewport.width}x${viewport.height}`,
            id: violation.id,
            impact: violation.impact ?? "unknown",
            nodes: violation.nodes.length,
            targets: violation.nodes.map((node) => node.target.join(" ")),
            help: violation.help,
          });
        }
      }
      await context.close();
    }

    const dir = join(process.cwd(), ".qa", "a11y");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "wave-08-axe.json"),
      JSON.stringify({ capturedAt: new Date().toISOString(), violations: all }, null, 2),
    );

    const blocking = all.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  }, 240_000);

  it("keyboard smoke: Ctrl+P focuses search; Tab reaches a note and Enter opens it", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await openScreen(page, "/", "#note-search");

    await page.keyboard.press("Control+p");
    await expect
      .poll(async () => page.evaluate(() => document.activeElement?.id))
      .toBe("note-search");

    // Tab from search through the toolbar into the virtualized note list.
    let reachedNote = false;
    for (let step = 0; step < 20 && !reachedNote; step += 1) {
      await page.keyboard.press("Tab");
      reachedNote = await page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(
          active instanceof HTMLButtonElement &&
            active.closest('[data-testid="notes-virtual-list"]') !== null,
        );
      });
    }
    expect(reachedNote).toBe(true);

    await page.keyboard.press("Enter");
    await page.waitForURL(/\/notes\//, { timeout: 10_000 });
    await context.close();
  }, 120_000);
});
