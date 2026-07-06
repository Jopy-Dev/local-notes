// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFolders, fetchNotesPage } from "../../src/frontend/services/notesApi";
import { useSettingsData } from "../../src/frontend/stores/settingsData";
import { useWorkspaceData } from "../../src/frontend/stores/workspaceData";
import { defaultConfig } from "../../src/shared/schemas/config.js";

vi.mock("../../src/frontend/services/notesApi", () => ({
  fetchNotesPage: vi.fn(async () => ({ notes: [], total: 0, nextCursor: null })),
  fetchFolders: vi.fn(async () => ({
    folders: ["daily", "projects"],
    counts: { daily: 1, projects: 5 },
    total: 9,
  })),
}));

/*
 * WF-001 folder navigation: selecting a folder scopes the server fetch to
 * that folder; "all" clears the scope; sidebar counts come from /folders
 * (never derived from a folder-scoped page).
 */
const fetchPageMock = vi.mocked(fetchNotesPage);
const fetchFoldersMock = vi.mocked(fetchFolders);

beforeEach(() => {
  fetchPageMock.mockClear();
  fetchFoldersMock.mockClear();
  useSettingsData.setState({ apply: vi.fn(async () => true) as never, config: defaultConfig("/ws") });
  useWorkspaceData.setState({
    folder: "all",
    sortBy: null,
    sortDirection: null,
    notes: [],
    nextCursor: null,
  });
});

describe("workspaceData folder scope (WF-001)", () => {
  it("selecting a folder refetches scoped pages", async () => {
    useWorkspaceData.getState().setFolder("projects");
    expect(useWorkspaceData.getState().folder).toBe("projects");
    await vi.waitFor(() =>
      expect(fetchPageMock).toHaveBeenCalledWith(
        expect.objectContaining({ folder: "projects" }),
      ),
    );
  });

  it("returning to All notes clears the scope", async () => {
    useWorkspaceData.setState({ folder: "projects" });
    useWorkspaceData.getState().setFolder("all");
    await vi.waitFor(() => expect(fetchPageMock).toHaveBeenCalled());
    const lastCall = fetchPageMock.mock.calls.at(-1)![0];
    expect("folder" in lastCall && lastCall.folder).toBeFalsy();
  });

  it("loadMore keeps the active folder scope", async () => {
    useWorkspaceData.setState({ folder: "daily", nextCursor: "abc" });
    await useWorkspaceData.getState().loadMore();
    expect(fetchPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "abc", folder: "daily" }),
    );
  });

  it("sidebar counts and workspace total hydrate from /folders", async () => {
    await useWorkspaceData.getState().loadInitial();
    const state = useWorkspaceData.getState();
    expect(state.folderCounts).toEqual({ daily: 1, projects: 5 });
    expect(state.workspaceTotal).toBe(9);
  });
});
