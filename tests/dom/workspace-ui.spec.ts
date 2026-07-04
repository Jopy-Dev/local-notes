// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsData } from "../../src/frontend/stores/settingsData";
import { PANE_BOUNDS, useWorkspaceUi } from "../../src/frontend/stores/workspaceUi";
import { defaultConfig } from "../../src/shared/schemas/config.js";

/*
 * Workspace pane layout store (REQ-034, WF-012): width commits debounce 250ms
 * and send only the changed field; persistence failure rolls back to the
 * last-persisted width; collapse persists the boolean immediately while the
 * prior width stays session-held for restore.
 */
let applyMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  applyMock = vi.fn(async () => true);
  useSettingsData.setState({ apply: applyMock as never, config: defaultConfig("/ws") });
  useWorkspaceUi.getState().hydrate(defaultConfig("/ws"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("workspaceUi (WF-012)", () => {
  it("debounces width commits and sends only the changed field", async () => {
    const ui = useWorkspaceUi.getState();
    ui.commitPane("folder", 250);
    ui.commitPane("folder", 260);
    expect(applyMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(applyMock).toHaveBeenCalledWith({ folderPaneWidth: 260 });
    expect(useWorkspaceUi.getState().widths.folder).toBe(260);
  });

  it("rolls a failed width commit back to the last-persisted value", async () => {
    applyMock.mockResolvedValueOnce(false);
    const ui = useWorkspaceUi.getState();
    ui.commitPane("notes", 400);
    await vi.advanceTimersByTimeAsync(250);
    expect(useWorkspaceUi.getState().widths.notes).toBe(PANE_BOUNDS.notes.default);
  });

  it("collapse persists the boolean immediately and restore returns the prior width", async () => {
    const ui = useWorkspaceUi.getState();
    ui.commitPane("folder", 264);
    await vi.advanceTimersByTimeAsync(250);
    applyMock.mockClear();

    useWorkspaceUi.getState().toggleCollapsed("folder");
    expect(applyMock).toHaveBeenCalledWith({ folderPaneCollapsed: true });
    expect(useWorkspaceUi.getState().collapsed.folder).toBe(true);

    useWorkspaceUi.getState().toggleCollapsed("folder");
    expect(applyMock).toHaveBeenCalledWith({ folderPaneCollapsed: false });
    expect(useWorkspaceUi.getState().collapsed.folder).toBe(false);
    expect(useWorkspaceUi.getState().widths.folder).toBe(264);
  });

  it("rolls a failed collapse back", async () => {
    applyMock.mockResolvedValueOnce(false);
    useWorkspaceUi.getState().toggleCollapsed("notes");
    await vi.advanceTimersByTimeAsync(0);
    expect(useWorkspaceUi.getState().collapsed.notes).toBe(false);
  });

  it("hydrates from ConfigV1 pane fields", () => {
    useWorkspaceUi.getState().hydrate({
      ...defaultConfig("/ws"),
      folderPaneWidth: 230,
      notesPaneWidth: 350,
      notesPaneCollapsed: true,
    });
    const state = useWorkspaceUi.getState();
    expect(state.widths).toEqual({ folder: 230, notes: 350 });
    expect(state.collapsed).toEqual({ folder: false, notes: true });
  });
});
