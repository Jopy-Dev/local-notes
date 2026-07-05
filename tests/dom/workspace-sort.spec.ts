// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNotesPage } from "../../src/frontend/services/notesApi";
import { useSettingsData } from "../../src/frontend/stores/settingsData";
import { useWorkspaceData } from "../../src/frontend/stores/workspaceData";
import { defaultConfig } from "../../src/shared/schemas/config.js";

vi.mock("../../src/frontend/services/notesApi", () => ({
  fetchNotesPage: vi.fn(async () => ({ notes: [], total: 0, nextCursor: null })),
  fetchFolders: vi.fn(async () => ({ folders: [] })),
}));

/*
 * WF-004.preferences: sort field/direction drive server-sorted fetches
 * (REQ-008), persist through the settings API optimistically, and roll back
 * (with a corrective refetch) when persistence fails.
 */
const fetchPageMock = vi.mocked(fetchNotesPage);

let applyMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchPageMock.mockClear();
  applyMock = vi.fn(async () => true);
  useSettingsData.setState({ apply: applyMock as never, config: defaultConfig("/ws") });
  useWorkspaceData.setState({ sortBy: null, sortDirection: null, notes: [], nextCursor: null });
});

describe("workspaceData sort preferences (WF-004 / REQ-008)", () => {
  it("loadInitial falls back to the persisted config sort", async () => {
    useSettingsData.setState({
      config: { ...defaultConfig("/ws"), sortBy: "size", sortDirection: "asc" },
    });
    await useWorkspaceData.getState().loadInitial();
    expect(fetchPageMock).toHaveBeenCalledWith({ sort: "size", direction: "asc" });
  });

  it("setSortBy refetches sorted pages and persists the preference", async () => {
    useWorkspaceData.getState().setSortBy("name");
    expect(useWorkspaceData.getState().sortBy).toBe("name");
    await vi.waitFor(() =>
      expect(fetchPageMock).toHaveBeenCalledWith({ sort: "name", direction: "desc" }),
    );
    expect(applyMock).toHaveBeenCalledWith({ sortBy: "name" });
  });

  it("persistence failure rolls the sort change back and refetches", async () => {
    applyMock.mockResolvedValueOnce(false);
    useWorkspaceData.getState().setSortBy("created");
    await vi.waitFor(() => expect(useWorkspaceData.getState().sortBy).toBeNull());
    await vi.waitFor(() =>
      expect(fetchPageMock).toHaveBeenLastCalledWith({ sort: "modified", direction: "desc" }),
    );
  });

  it("setSortDirection persists and refetches with the new direction", async () => {
    useWorkspaceData.getState().setSortDirection("asc");
    await vi.waitFor(() => expect(applyMock).toHaveBeenCalledWith({ sortDirection: "asc" }));
    expect(fetchPageMock).toHaveBeenCalledWith({ sort: "modified", direction: "asc" });
  });

  it("loadMore keeps the active sort on appended pages", async () => {
    useWorkspaceData.setState({ sortBy: "name", nextCursor: "abc" });
    await useWorkspaceData.getState().loadMore();
    expect(fetchPageMock).toHaveBeenCalledWith({ cursor: "abc", sort: "name", direction: "desc" });
  });
});
