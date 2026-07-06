/*
 * Step 15 route manifest (Implementation_Plan.md 6.1). Canonical route
 * inventory consumed by verify:local + evidence validation: every PRD
 * SCREEN-### appears exactly once with its six states, criticality, and
 * evidence method. Single human role per PRD 3 (Local Operator); there is no
 * RBAC surface, so deniedRoles is always empty - path escape is the
 * IDOR-equivalent boundary and lives in WorkspacePathGuard tests.
 */
export type Criticality = "standard" | "critical";

export type EvidenceMethod = { kind: "automated" } | { kind: "manual"; reason: string };

export interface RouteStates {
  populated: string;
  loading: string;
  empty: string;
  error: string;
  success: string;
  postRestart: string;
}

export interface RouteDefinition {
  screenId: string;
  name: string;
  /* Client route, or a terminal: marker for pre-server CLI surfaces. */
  path: string;
  roles: readonly string[];
  deniedRoles: readonly string[];
  states: RouteStates;
  criticality: Criticality;
  evidence: EvidenceMethod;
}

const LOCAL_OPERATOR = "local-operator" as const;

export const routes: readonly RouteDefinition[] = [
  {
    screenId: "SCREEN-001",
    name: "Dashboard",
    path: "/",
    roles: [LOCAL_OPERATOR],
    deniedRoles: [],
    states: {
      populated: "note list + folder tree with counts",
      loading: "list skeleton",
      empty: "create-action empty state",
      error: "partial-error banner; degraded index links recovery",
      success: "list reflects current filesystem",
      postRestart: "view/sort/pane preferences restored",
    },
    criticality: "critical",
    evidence: { kind: "automated" },
  },
  {
    screenId: "SCREEN-002",
    name: "Note Workspace",
    path: "/notes/:noteKey",
    roles: [LOCAL_OPERATOR],
    deniedRoles: [],
    states: {
      populated: "read mode with rendered preview",
      loading: "note skeleton",
      empty: "unknown key -> missing state (envelope 404)",
      error: "missing/unreadable/oversized states distinct",
      success: "editable draft + saved status",
      postRestart: "note reopens from route; draft never persists",
    },
    criticality: "critical",
    evidence: { kind: "automated" },
  },
  {
    screenId: "SCREEN-003",
    name: "Settings",
    path: "/settings",
    roles: [LOCAL_OPERATOR],
    deniedRoles: [],
    states: {
      populated: "form ready with active workspace path",
      loading: "form loading",
      empty: "n/a - config always has defaults",
      error: "invalid field identified + persistence error",
      success: "applied toast; appearance updates live",
      postRestart: "persisted values restored",
    },
    criticality: "standard",
    evidence: { kind: "automated" },
  },
  {
    screenId: "SCREEN-004",
    name: "Workspace Lock Error",
    path: "terminal:workspace-lock",
    roles: [LOCAL_OPERATOR],
    deniedRoles: [],
    states: {
      populated: "lock ownership message with pid/host",
      loading: "n/a - immediate",
      empty: "n/a",
      error: "stale-recovery failure detail",
      success: "exit code 2",
      postRestart: "n/a - terminal surface",
    },
    criticality: "standard",
    evidence: { kind: "manual", reason: "pre-server CLI stderr; captured as terminal transcript" },
  },
  {
    screenId: "SCREEN-005",
    name: "Startup Error",
    path: "terminal:startup-error",
    roles: [LOCAL_OPERATOR],
    deniedRoles: [],
    states: {
      populated: "error detail per failure class",
      loading: "n/a - immediate",
      empty: "n/a",
      error: "config/port/unexpected variants (exit 1/3/4)",
      success: "n/a - this surface is the failure",
      postRestart: "n/a - terminal surface",
    },
    criticality: "standard",
    evidence: { kind: "manual", reason: "pre-server CLI stderr; captured as terminal transcript" },
  },
  {
    screenId: "SCREEN-006",
    name: "External Change Conflict",
    path: "/notes/:noteKey",
    roles: [LOCAL_OPERATOR],
    deniedRoles: [],
    states: {
      populated: "conflict panel preserving both versions",
      loading: "resolving",
      empty: "n/a",
      error: "resolution error keeps draft",
      success: "resolved toast; chosen version on disk + editor",
      postRestart: "unresolved draft discarded by contract (memory-only)",
    },
    criticality: "critical",
    evidence: { kind: "automated" },
  },
  {
    screenId: "SCREEN-008",
    name: "Archive Note View",
    path: "/archive/:noteKey",
    roles: [LOCAL_OPERATOR],
    deniedRoles: [],
    states: {
      populated: "read-only archived content with archive banner",
      loading: "busy surface while archived document loads",
      empty: "missing archived key -> not-found message",
      error: "restore collision / delete failure surface recoverable errors",
      success: "restore navigates to active note; delete reaches recycle bin and returns to list",
      postRestart: "archive list and counts rebuild from the archive tree",
    },
    criticality: "standard",
    evidence: { kind: "automated" },
  },
  {
    screenId: "SCREEN-007",
    name: "Search Recovery",
    path: "/recovery/search",
    roles: [LOCAL_OPERATOR],
    deniedRoles: [],
    states: {
      populated: "degraded status explanation",
      loading: "rebuilding progress",
      empty: "n/a",
      error: "rebuild failed; editing remains available",
      success: "index ready; search restored",
      postRestart: "index reconciles from checkpoint",
    },
    criticality: "standard",
    evidence: { kind: "automated" },
  },
];

/*
 * Critical journeys (Implementation_Plan.md 6.1): cross-browser scope at
 * Step 15. No auth journey exists - the capability boundary is request-level
 * and covered by REQ-027 security tests.
 */
export interface CriticalJourney {
  id: string;
  name: string;
  screens: readonly string[];
}

export const criticalJourneys: readonly CriticalJourney[] = [
  { id: "launch", name: "Launch to interactive dashboard", screens: ["SCREEN-001"] },
  { id: "edit-autosave", name: "Open note, edit, autosave", screens: ["SCREEN-001", "SCREEN-002"] },
  { id: "conflict", name: "External change conflict resolution", screens: ["SCREEN-002", "SCREEN-006"] },
  { id: "search", name: "Ranked search to note open", screens: ["SCREEN-001", "SCREEN-002"] },
  { id: "archive", name: "Archive with draft flush", screens: ["SCREEN-001", "SCREEN-002"] },
];
