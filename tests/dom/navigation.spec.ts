// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  closeSettingsRoute,
  navigate,
  openSettingsRoute,
  settingsReturnNoteKey,
} from "../../src/frontend/services/navigation.js";

/*
 * Settings route lifecycle (SCREEN-003, MasterPrompt.md 1.6): opening
 * /settings remembers where it came from so the shell keeps that note
 * mounted under the dialog, and close is idempotent - the Modal close event
 * fires after Apply already navigated, and the second call must not consume
 * a fresh navigation to "/". Regression for the Wave 7 settings-apply
 * defect (note unmount flushed a phantom draft; double-close landed on "/").
 */
beforeEach(() => {
  // Reset module route state: land on a note without settings involvement.
  navigate("/");
  if (window.location.pathname === "/settings") closeSettingsRoute();
});

describe("settings route lifecycle", () => {
  it("remembers the note the dialog opened over and returns to it", () => {
    navigate("/notes/d2VsY29tZS5tZA");
    openSettingsRoute();
    expect(window.location.pathname).toBe("/settings");
    expect(settingsReturnNoteKey()).toBe("d2VsY29tZS5tZA");
    closeSettingsRoute();
    expect(window.location.pathname).toBe("/notes/d2VsY29tZS5tZA");
  });

  it("close is idempotent: a second close never navigates again", () => {
    navigate("/notes/d2VsY29tZS5tZA");
    openSettingsRoute();
    closeSettingsRoute();
    expect(window.location.pathname).toBe("/notes/d2VsY29tZS5tZA");
    closeSettingsRoute();
    expect(window.location.pathname).toBe("/notes/d2VsY29tZS5tZA");
  });

  it("direct /settings load has no return note and closes to the dashboard", () => {
    navigate("/settings");
    expect(settingsReturnNoteKey()).toBeNull();
    closeSettingsRoute();
    expect(window.location.pathname).toBe("/");
  });

  it("dashboard origin keeps no return note", () => {
    navigate("/");
    openSettingsRoute();
    expect(settingsReturnNoteKey()).toBeNull();
    closeSettingsRoute();
    expect(window.location.pathname).toBe("/");
  });
});
