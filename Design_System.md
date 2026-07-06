# Design System: Local-Notes

**Version:** v1.6 - LOCKED  
**Last updated:** 2026-07-04

## 1. Brand Identity

- Product role: local-first filesystem note workspace for sustained desktop use.
- Direction: Quiet Workbench.
- Vibe: focused, calm, native.
- Atmosphere dials: Density `8/10`; Variance `3/10`; Motion `2/10`; Creativity `4/10`. Source: approved `.claude-design/project/index.html` + `.claude-design/project/app-shell.html`.
- Target user: individual knowledge worker prioritizing offline access, ordinary files, keyboard speed, and predictable data safety.

### 1.1 Design Intake Snapshot

| Field | Locked decision | Source |
|---|---|---|
| Product/context | Browser UI served by one local Node.js process; filesystem remains source of truth | `PRD.md` §1; `MasterPrompt.md` §1 |
| Audience/role | One Local Operator using desktop/laptop browser | `PRD.md` §3; `PRODUCT.md` Users |
| Required surfaces | Dashboard, note workspace, settings, workspace/startup errors, conflict resolution, search recovery | `SCREEN-001`-`SCREEN-007` |
| Vibe/reference | Focused, calm, native; Quiet Workbench | `PRODUCT.md`; user-approved direction |
| Anti-reference | Neon cyberpunk, glass, gradients, oversized SaaS cards, ornamental motion, marketing chrome | `PRODUCT.md` Anti-references |
| Density | Dense native desktop tool; editor remains primary | Approved app-shell prototype |
| Motion | State-only, short, reduced-motion safe | `PRODUCT.md` Design Principles; `REQ-030` |
| Priority devices | Full UI at `1024x640` and above; optimize `1280x720` and `1440x900`; smaller viewports show guidance | `REQ-031`; user-approved deviation |

### 1.2 Design Direction Decision

| Direction | Decision | Reason | Translation |
|---|---|---|---|
| Quiet Workbench | Chosen and approved | Warm low-glare graphite, restrained amber, dense native hierarchy, editor-first layout | §§2-7 tokens; `<AppShell>`, `<NoteWorkspace>`, `<FocusModeToggle>` |
| Slate Command | Rejected | Too cool and IDE-first for writing-focused product | Ban cool neon/cyan emphasis |
| Editorial Desk | Rejected | Serif/editorial language weakens `.txt` and source-editor consistency | Use system sans + system mono |

- Source path: Path 1, assistant-generated launch + app-shell HTML.
- Approved source artifacts: `.claude-design/project/index.html`, `.claude-design/project/app-shell.html`.
- Token authority: this file; prototypes become parity references only.

## 2. Color Tokens

All values originate in approved prototypes. Raw color literals are allowed only in token definitions.

### 2.1 Brand

| Name | Value | Role | Tailwind key | Contrast notes | Banned use |
|---|---|---|---|---|---|
| Accent | `#c49a59` | Primary action, active edge, syntax heading | `accent` | 6.94:1 on root; accent ink 6.60:1 | Large decorative fills |
| Accent hover | `#d0a765` | Primary hover | `accent-hover` | Use with accent ink | Persistent selected backgrounds |
| Accent muted | `#725b37` | Subtle selection/support | `accent-muted` | 2.79:1 on root; never text/focus alone | Body text |
| Accent ink | `#211b12` | Text/icon on accent | `accent-ink` | 6.60:1 on accent | Text on dark surfaces |
| Focus | `#e0b875` | Keyboard focus ring | `focus` | 9.65:1 on root | Decorative border |

### 2.2 Neutral

| Name | Value | Role | Tailwind key | Contrast notes | Banned use |
|---|---|---|---|---|---|
| Root | `#171714` | Page/app canvas | `surface-root` | Primary text 14.63:1 | Pure black replacement elsewhere |
| Titlebar | `#1a1a16` | Top application chrome | `surface-titlebar` | Pair with primary/secondary text | Cards |
| Sidebar | `#1c1c18` | Folder navigation | `surface-sidebar` | Pair with primary/secondary text | Editor source canvas |
| Panel | `#20201b` | Note list/dialog sections | `surface-panel` | Primary 13.33:1; muted 5.05:1 | Full-page canvas |
| Editor | `#191916` | Preview/editor workspace | `surface-editor` | Pair with primary/secondary text | Inputs |
| Code | `#141411` | Source editor/code blocks | `surface-code` | Source text 12.45:1 | General panels |
| Input | `#151512` | Inputs/search/segmented base | `surface-input` | Pair with primary/secondary text | Selected state |
| Raised | `#292821` | Modal/popover/control active | `surface-raised` | Muted text remains >=4.5:1 | Main canvas |
| Hover | `#302f27` | Pointer hover | `surface-hover` | Transient only | Persistent state |
| Selected | `#383329` | Current note/navigation | `surface-selected` | Primary 10.22:1; secondary 5.14:1 | Large page section |
| Border subtle | `#34332b` | Separators | `border-subtle` | Not sole state indicator | Focus/error state |
| Border strong | `#4a483b` | Raised/control outline | `border-strong` | Not sole state indicator | Focus ring |
| Border active | `#6b5b3e` | Warning/active edge | `border-active` | Pair with icon/text | Focus ring |
| Text primary | `#ebe8dc` | Headings, key labels | `text-primary` | 14.63:1 on root | Disabled text |
| Text secondary | `#aaa697` | Body, descriptions | `text-secondary` | 7.37:1 on root | Disabled text |
| Text muted | `#938f80` | Metadata, paths | `text-muted` | 5.54:1 on root; 5.05:1 on panel | Critical instructions below 12px |
| Text disabled | `#858276` | Disabled labels | `text-disabled` | 4.66:1 on root | Active controls |
| Text source | `#d8d4c7` | Source editor body | `text-source` | 12.45:1 on code | General chrome |
| Text code | `#d6b77d` | Code/syntax emphasis | `text-code` | 9.60:1 on code | General body text |
| Syntax accent | `#c49a59` (dark) / `#77571a` (light) | Source-editor heading/link syntax color | `syntax-accent` | 7.3:1 on code dark; 5.5:1 on code light (brand accent misses AA on light code surface - v1.6, REQ-030) | Chrome accents (use `accent`) |

### 2.3 Semantic

| Name | Value | Role | Tailwind key | Contrast notes | Banned use |
|---|---|---|---|---|---|
| Success | `#83a87a` | Saved/available | `success` | 6.71:1 on root; 5.56:1 on success bg | Decorative green |
| Success bg | `#202a1f` | Success banner | `success-bg` | Pair with success + text primary | Standalone status |
| Warning | `#c9a15f` | Conflict, metadata-only | `warning` | 7.48:1 on root; 6.33:1 on warning bg | Primary action |
| Warning bg | `#2b251a` | Conflict/warning banner | `warning-bg` | Pair with warning icon + text | Generic panel |
| Danger | `#ca7a70` | Archive/destructive/error | `danger` | 5.58:1 on root; 4.84:1 on danger bg | Selected navigation |
| Danger bg | `#2d211f` | Error/destructive banner | `danger-bg` | Pair with danger icon + text | Generic panel |
| Info | `#8d9ca8` | Read-only/recovery information | `info` | 6.38:1 on root | Brand accent |

### 2.4 State Colors

| State | Token | Use |
|---|---|---|
| Default | `text-secondary` + `border-subtle` | Neutral controls/content |
| Hover | `surface-hover` + `text-primary` | Pointer hover only |
| Selected | `surface-selected` + `accent` inset edge | Active note/navigation |
| Focus | `focus` 2px ring + 1px offset | All keyboard focus |
| Disabled | `text-disabled` + reduced interaction | Preserve readable label |
| Loading | `text-muted` + skeleton surface pulse | No color-only meaning |
| Success | `success` + check/status copy | Saved/ready |
| Warning/conflict | `warning-bg` + `warning` icon + explicit text | External change/index budget |
| Error | `danger-bg` + `danger` icon + field/error copy | Validation/save/startup errors |
| Info/read-only | `info` icon + explicit explanation | Oversized/unsupported encoding |

### 2.5 Banned

- Pure black, pure white, neon purple/cyan, gradients, glass/transparency effects. Source: `PRODUCT.md`.
- Additional brand accent hues. Semantic colors only for status. Source: approved Quiet Workbench direction.
- Border/color as sole state communication. Source: `REQ-030`.
- Remote color/theme assets. Source: `REQ-026`.

### 2.6 Light Theme (`data-theme="light"`)

Warm-paper light palette; same single amber hue family. Activation: `services/theme.ts` sets `<html data-theme>`; tokens override in `src/frontend/styles/app.css` `[data-theme="light"]` block. Dark tables §2.1-2.3 stay authoritative for default theme. Every ratio machine-verified (WCAG relative luminance). Source: user-approved light token table 2026-07-04.

| Token | Light value | Verified contrast | Notes |
|---|---|---|---|
| `accent` | `#8a6222` | 4.83:1 on root; 4.96:1 on editor | Darkened amber; link text passes normal-text 4.5:1 |
| `accent-hover` | `#7a5519` | accent ink 6.36:1 | Hover darkens (light convention) |
| `accent-muted` | `#dcc79b` | text primary on it 9.41:1 | Wash bg (find-match); never text |
| `accent-ink` | `#fdf9ef` | 5.19:1 on accent | Text/icon on accent |
| `focus` | `#6b4c14` | 6.97:1 on root; 7.47:1 on input | Min 3:1 non-text |
| `surface-root` | `#f4f1e8` | Primary text 13.79:1 | Warm paper canvas |
| `surface-titlebar` | `#ece8da` | Pair with primary/secondary text | |
| `surface-sidebar` | `#efebdf` | Pair with primary/secondary text | |
| `surface-panel` | `#f1ede2` | Primary 13.31:1; secondary 7.74:1 | |
| `surface-editor` | `#f7f4ec` | Secondary 8.24:1 | Lighter = writing focus |
| `surface-code` | `#ece7d6` | Source text 10.66:1 | Mono wells darker |
| `surface-input` | `#fbf9f2` | Pair with primary/secondary text | Inputs lightest |
| `surface-raised` | `#fdfbf5` | Muted text 6.38:1 | Popover/modal |
| `surface-hover` | `#e6e1d0` | Primary 11.90:1 | Transient only |
| `surface-selected` | `#e3dcc5` | Primary 11.35:1; secondary 6.60:1 | Amber-warmed |
| `border-subtle` | `#d8d2bf` | 1.34:1 on root (dark parity 1.42) | Never sole state indicator (§11) |
| `border-strong` | `#b3ab93` | 2.03:1 on root (dark parity 1.95) | Never sole state indicator (§11) |
| `border-active` | `#a08850` | 3.03:1 on root (beats dark 2.73) | Pair with icon/text |
| `text-primary` | `#262419` | 13.79:1 on root; 11.35:1 on selected | |
| `text-secondary` | `#4c4939` | 8.02:1 on root; 6.60:1 on selected | |
| `text-muted` | `#615d4c` | 5.85:1 on root; 5.65:1 on panel | |
| `text-disabled` | `#6b6758` | 5.02:1 on root | |
| `text-source` | `#32302a` | 10.66:1 on code | |
| `text-code` | `#77571a` | 5.37:1 on code | |
| `success` / `success-bg` | `#3f6b35` / `#e0e9d6` | 5.52:1 on root; 4.99:1 on bg | |
| `warning` / `warning-bg` | `#7d5a17` / `#f0e5c6` | 5.56:1 on root; 5.00:1 on bg | |
| `danger` / `danger-bg` | `#a03a2e` / `#f4ddd6` | 5.92:1 on root; 5.15:1 on bg | |
| `info` | `#48626f` | 5.72:1 on root | |

Light elevation overrides (§6 tokens):

| Token | Light value |
|---|---|
| `shadow-selected` | `inset 2px 0 0 #8a6222` |
| `shadow-control-active` | `0 0 0 1px #b3ab93` |
| `shadow-status` | `0 0 0 2px rgb(63 107 53 / 18%)` |
| `shadow-popover` | `0 18px 50px rgb(76 73 57 / 25%)` |

- `html[data-theme="light"]` sets `color-scheme: light` for native controls/scrollbars.
- System theme resolves via `matchMedia("(prefers-color-scheme")` in `services/theme.ts`; no FOUC requirement beyond default-dark first paint.

## 3. Typography

### 3.1 Families

| Use | Family | Weights | Tailwind key | Loading |
|---|---|---|---|---|
| UI/display | `"Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif` | `400`, `500`, `650`, `700` | `font-ui` | Local system stack; no network request or `@font-face` |
| Source/code | `"Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace` | `400`, `600` | `font-mono` | Local system stack; no network request |

### 3.2 Scale

| Token | Size | Line height | Use |
|---|---:|---:|---|
| `text-2xs` | `10px` | `1.2` | Redundant shortcut/metadata only |
| `text-xs` | `11px` | `1.35` | Paths, timestamps, counts |
| `text-sm` | `12px` | `1.45` | Helpers, compact controls |
| `text-ui` | `13px` | `1.45` | Navigation, note titles, buttons |
| `text-body` | `14px` | `1.6` | Default editor/body |
| `text-h3` | `17px` | `1.35` | Preview section heading |
| `text-title` | `19px` | `1.25` | Note/dialog title |
| `text-display-sm` | `23px` | `1.25` | Launch heading |
| `text-display` | `25px` | `1.25` | Preview document heading |

### 3.3 Rules

- Source: approved prototypes; editor default also required by `REQ-021`.
- Editor width (`REQ-021`, v1.6 user feedback round 2b): NO line-length cap and no width setting - editor and preview always fill their pane. The capped column (65-90ch tiers, earlier revisions) left unusable blank space on widescreen displays. Source: user-approved 2026-07-05.
- Dense desktop deviation: `10px`-`12px` permitted only for redundant metadata/shortcuts; critical labels use `13px` or larger.
- Editor size user setting: integer `12px`-`24px`; default `14px`.
- Editor line height user setting: `1.2`-`2.0`; default `1.6`.
- Headings use `650`/`700`; UI body uses `400`/`500`; no ultra-light text.
- Paths, timestamps, line numbers, code, and shortcut keys use mono/tabular numerals.
- Tracking: UI default `0`; eyebrows `0.08em`; large titles `-0.012em`.
- Serif prohibited in application chrome and source editor. Source: rejected Editorial Desk direction.

## 4. Layout & Spacing

### 4.1 Containers

| Token | Value | Use |
|---|---|---|
| `layout-app` | `100vw x min-height:100dvh` | Full local application |
| `layout-titlebar` | `42px` | Standard app topbar |
| `layout-statusbar` | `24px` | Persistent local/file status |
| `layout-folders` | `220px`; compact `190px` | Folder navigation |
| `layout-notes` | `320px`; compact `280px` | Virtual note list |
| `layout-rail-collapsed` | `28px` | Collapsed folder/notes pane rail (`REQ-034`); holds expand affordance + pane icon; focusable; `aria-expanded=false` |
| `layout-editor` | `minmax(0,1fr)` | Note workspace |
| `layout-split` | `minmax(320px,1fr)` x 2 | Source + preview at >=1200px |
| `layout-preview` | fills pane, no max-width (round 2b) | Rendered prose |
| `layout-dialog` | `min(520px,100vw-48px)` | Standard dialog |
| `layout-command` | `min(620px,100vw-48px)` | Command palette |
| `layout-focus` | Editor + status only | Hide titlebar/folder/note panes; preserve note tools |

### 4.2 Spacing Scale

| Token | Value | Use |
|---|---:|---|
| `spacing-0.5` | `2px` | Segmented inset, micro gaps |
| `spacing-1` | `4px` | Icon/control gaps |
| `spacing-1.5` | `6px` | Status/compact gaps |
| `spacing-2` | `8px` | Control padding |
| `spacing-2.5` | `10px` | Toolbar gaps |
| `spacing-3` | `12px` | Standard panel padding |
| `spacing-3.5` | `14px` | Compact content edge |
| `spacing-4` | `16px` | Form/content block |
| `spacing-4.5` | `18px` | Editor/dialog horizontal edge |
| `spacing-5.5` | `22px` | Empty-state horizontal padding |
| `spacing-6` | `24px` | Dialog outer/mobile clearance |
| `spacing-8` | `32px` | Empty-state vertical rhythm |

### 4.3 Breakpoints

| Breakpoint | Width | Verification target |
|---|---:|---|
| `unsupported-sm` | `360px` | Resize guidance; zero overflow |
| `unsupported-md` | `390px` | Resize guidance; zero overflow |
| `unsupported-tablet` | `768px` | Resize guidance; zero overflow |
| `desktop-min` | `1024px` and height `640px` | Full app; compact `190/280/editor` defaults |
| `desktop` | `1280px` | Primary optimized target |
| `desktop-wide` | `1440px` | Product acceptance target |
| `desktop-2xl` | `1536px` | Wide-layout balance |

- Below `1024px` width or `640px` height: render `<UnsupportedViewport>`, not collapsed mobile navigation.
- v1.5: pane resize/collapse (`REQ-034`) active at every supported width (`>=1024px`), not `desktop`-gated - display scaling puts real windows under `1280` CSS px (user feedback round 1). Compact column values remain the defaults at `desktop-min`.
- Mobile/tablet workflow support is outside MVP by user-approved deviation. No hidden mobile menu substitutes for unsupported guidance.
- No page-level horizontal scrolling at any verification width.
- Focus Mode uses full editor width at every supported desktop viewport.

### 4.4 Z-Index

| Token | Value | Use |
|---|---:|---|
| `z-base` | `0` | Panes/content |
| `z-sticky` | `10` | Sticky toolbar/header |
| `z-dropdown` | `20` | Popover/menu |
| `z-overlay` | `30` | Scrim |
| `z-modal` | `40` | Dialog/drawer |
| `z-toast` | `50` | Toast/status feedback |

## 5. Radius & Shape

| Token | Value | Use |
|---|---:|---|
| `radius-none` | `0` | Pane boundaries, lists |
| `radius-xs` | `2px` | Title focus/compact inset |
| `radius-sm` | `3px` | Segments, file badges, code |
| `radius-control` | `4px` | Buttons, inputs, search |
| `radius-panel` | `6px` | Dialogs, popovers, empty-state card |
| `radius-switch` | `9px` | Switch track |
| `radius-pill` | `9999px` | Status dots only |

- Source: approved prototypes.
- Shape philosophy: restrained/sharp; avoid pill buttons and oversized soft cards.

## 6. Elevation

| Token | Value | Use |
|---|---|---|
| `shadow-none` | `none` | Main panes; hierarchy via borders |
| `shadow-selected` | `inset 2px 0 0 #c49a59` | Current note |
| `shadow-control-active` | `0 0 0 1px #4a483b` | Active segment |
| `shadow-status` | `0 0 0 2px rgb(131 168 122 / 12%)` | Saved/ready dot halo |
| `shadow-popover` | `0 18px 50px rgb(8 8 6 / 44%)` | Modal, popover, command palette |

- Source: approved prototypes.
- Flat default. Elevation exists only for transient layers and active-control clarity.

## 7. Motion

| Token | Value | Use | Reduced-motion behavior |
|---|---|---|---|
| `duration-fast` | `120ms` | Hover/focus/color/opacity | `0.01ms` |
| `duration-standard` | `180ms` | Popover/toast/switch transform | `0.01ms` |
| `ease-standard` | `cubic-bezier(0.2,0,0,1)` | All routine transitions | State changes remain immediate |
| `transition-control` | color, border-color, background-color | Controls | No animation |
| `transition-overlay` | opacity + transform | Dialog/toast/popover | No motion; visibility retained |

- No perpetual animation.
- No width/height/top/left animation for routine UI.
- Autosave debounce `750ms` is behavior, not motion.
- Toast visibility target `2200ms`; critical errors persist until action.

## 8. Assets

| Asset | Path/source | Dimensions | Format | Loading rule | Alt/caption rule |
|---|---|---:|---|---|---|
| App icon | `src/frontend/assets/local-notes.svg` | `32x32` master | SVG | Bundle locally; inline where CSP nonce permits | Decorative when brand name adjacent |
| UI icons | Project-owned icon components | `14`, `16`, `18`, `20`, `24` | SVG | Bundle only; `currentColor`; no CDN | `aria-hidden` when button has label; otherwise button gets accessible name |
| Favicon | `public/favicon.svg` | `32x32` | SVG | Local static asset | Decorative |
| Markdown image | Guarded `/api/v1/assets/:assetKey` blob | Intrinsic | PNG/JPEG/GIF/WebP/AVIF/BMP/ICO | Lazy below fold; revoke object URL on replacement/unmount | Note-provided alt; blocked source gets explicit placeholder |
| QA screenshots | `.qa/parity-audit/wave-00/*.png` | Viewport-specific | PNG | Development evidence only; never ship | Not product content |

- No hero/LCP image; launch surface is HTML/CSS/SVG.
- No remote fonts, image CDNs, placeholder services, video, or autoplay media.
- SVG note assets are blocked by content policy; application-owned SVG remains trusted bundle code.

## 9. Components

Implementation target: `src/frontend/components/ui/*` for primitives; feature composition under `src/frontend/components/*` and `src/frontend/editor/*`.

### 9.1 Foundation Primitives

| Component | Variants / props sketch | Required states | A11y contract | Notes |
|---|---|---|---|---|
| `<Button>` | `variant: primary|secondary|compact|danger`; `size: sm|md`; `loading` | default, hover, focus, active, disabled, loading | Native button; accessible name; loading announced | Accent only for primary; source: launch/dialogs |
| `<IconButton>` | `label`, `pressed?`, `tooltip?` | default, hover, focus, pressed, disabled | `aria-label`; `aria-pressed` for toggles; 28-32px desktop control | Source: topbar/editor; also inline copy affordance appended after `<copy>`-marked text (`REQ-036`) |
| `<Input>` | `type`, `value`, `invalid`, `describedBy` | default, hover, focus, disabled, invalid | External label; error association; no placeholder-only label | Source: search/create/title |
| `<Textarea>` | `value`, `rows`, `resize` | default, focus, disabled, invalid | Label + helper/error IDs | Used for plain settings/error details when needed |
| `<Select>` | `value`, `options`, `invalid` | default, hover, focus, disabled, invalid | Native select for MVP; visible label | Source: sort/settings |
| `<Checkbox>` | `checked`, `indeterminate` | default, hover, focus, disabled, checked | Native input + label; state not color-only | Reserved form primitive |
| `<RadioGroup>` | `value`, `options`, `orientation` | default, focus, disabled, selected | Arrow-key group behavior; fieldset/legend | Settings choices when select is unsuitable |
| `<Switch>` | `checked`, `disabled`, `label` | off, on, hover, focus, disabled | Native checkbox semantics; visible label | Source: settings autosave |
| `<DatePicker>` | `value`, `min`, `max`, `invalid` | default, focus, disabled, invalid | Label; keyboard date input; locale-safe | Documented minimum primitive; no MVP screen instantiates it |
| `<Card>` | `variant: panel|empty|warning`; `selected?` | default, hover when actionable, selected, disabled | Semantic section/article; no nested interactive card traps | Use sparingly; dividers preferred |
| `<SectionHeader>` | `title`, `description?`, `actions?` | default | Correct heading level; actions follow title | Settings/empty/recovery sections |
| `<NavBar>` | `brand`, `path`, `actions` | default, error/degraded indicator | Landmark `banner`; ordered keyboard actions | App titlebar/launch chrome |
| `<MobileMenu>` | none in MVP | not rendered | N/A | Prohibited by desktop-only deviation; `<UnsupportedViewport>` replaces it |
| `<Footer>` | `items`, `status` | default, degraded | `contentinfo` | Implemented as `<StatusBar>`, never marketing footer |
| `<Sidebar>` | `sections`, `activeKey` | loading, empty, ready, partial error | `complementary` + labelled navigation; current item indicated | Source: folder pane |
| `<Topbar>` | `path`, `command`, `settings` | ready, degraded | `banner`; shortcut labels nonessential | Source: app shell |
| `<DataTable>` | `columns`, `rows`, `sort`, `loading` | loading, empty, error, populated, sorted | Semantic table; sortable headers announce direction | Available for dense metadata; notes default to list/card |
| `<Pagination>` | `cursor`, `hasMore`, `loading` | idle, loading, end, error | Button announces appended count | Notes use load-more batches of 200; never numbered pages |
| `<Tabs>` | `value`, `items` | default, hover, focus, selected, disabled | Arrow keys + `aria-selected`; tabpanel linkage | Editor mode may use segmented tabs |
| `<Modal>` | `open`, `title`, `description`, `onClose` | opening, open, submitting, error | Focus trap; labelled dialog; Escape unless destructive confirmation active | Source: create/settings |
| `<Drawer>` | `side: right|bottom`, `open` | opening, open, error | Dialog semantics + focus return | Move-note folder selection; not mobile navigation |
| `<Popover>` | `trigger`, `placement` | closed, open, disabled | Trigger `aria-expanded`; Escape/outside close; focus return | Note actions |
| `<Tooltip>` | `content`, `delay` | hidden, visible | Supplemental only; never sole label | Icon shortcuts |
| `<Toast>` | `tone`, `message`, `action?` | entering, visible, leaving | `role=status`; error uses persistent alert | Local operation feedback |
| `<FormField>` | `label`, `helper`, `error`, `required` | default, invalid, disabled | Label/input/error IDs wired | Source: create/settings |
| `<Skeleton>` | `shape: row|text|editor` | loading | `aria-hidden`; container exposes busy/status copy | Match final geometry; no spinner for page loads |
| `<EmptyState>` | `icon`, `title`, `cause`, `action` | empty, no-result | Heading + actionable next step | Workspace empty/search no result |

### 9.2 Project Primitives

| Component | Variants / props sketch | Required states | A11y contract | Notes |
|---|---|---|---|---|
| `<AppShell>` | `layout: standard|focus`; `indexStatus` | loading, ready, degraded, unsupported | Logical landmarks; skip/focus order follows visible panes | Source: `SCREEN-001/002`, Focus Mode |
| `<UnsupportedViewport>` | `width`, `height`, `minimum` | visible below contract | Heading + exact current/min dimensions | No full workflow below `1024x640` |
| `<WorkspaceLaunchPanel>` | `workspaceState`, `onChoose`, `onDefault` | empty, selecting, error, ready | Primary action first; dialog focus return | Launch prototype adaptation |
| `<StatusBar>` | `saveState`, `path`, `encoding`, `lineEnding`, `localOnly` | saved, saving, conflict, error, degraded | `contentinfo`; live save text elsewhere prevents noise | Always visible in focus layout |
| `<FolderTree>` | `nodes`, `activeKey`, `counts` | loading, empty, ready, partial error | Tree/nav keyboard behavior; current item explicit | Existing folders only |
| `<DashboardToolbar>` | `query`, `sort`, `direction` | idle, searching, degraded, error | Search label; sort direction pressed state | `WF-002/004`; view toggle removed v1.6 |
| `<NotesVirtualList>` | `items`, `selectedKey`, `hasMore` | loading, empty, partial error, ready, loading-more | List/listbox semantics chosen consistently; virtual focus retention | 10,000-note support |
| `<NoteListItem>` | `metadata`, `selected`, `indexStatus` | default, hover, focus, selected, metadata-only, truncated | One accessible name; warning copy explicit | List variant |
| `<SearchResult>` | `title`, `snippet`, `ranges`, `indexStatus` | normal, metadata-only, truncated | `<mark>` for match; warning text | Snippet max 180 chars |
| `<CommandPalette>` | `commands`, `query` | open, filtered, no-result | Modal combobox/listbox; Escape closes; focus returns | `Ctrl+K` |
| `<EditorHeader>` | `path`, `title`, `saveState`, `mode`, `layout` | editable, read-only, conflict, error | Title label; live save state; actions named | Preserved in Focus Mode |
| `<EditorModeTabs>` | `mode: read|source|split` | selected, unavailable | Tab/pressed semantics; shortcut documented | v1.6: Edit tab removed; `.txt` hides Markdown-only modes |
| `<FocusModeToggle>` | `layout`, `onToggle` | standard, focus, disabled | `aria-pressed`; label changes enter/exit | `Ctrl+Shift+F`; Escape restores |
| `<SourceEditor>` | `content`, `language`, `readOnly`, `toolbar` | loading, editable, read-only, error | CodeMirror keyboard/a11y contract; textbox carries accessible name; visible focus | Mono; default 14px user-controlled; single editing surface v1.6 |
| `<MarkdownToolbar>` | `getView`, `readOnly` | ready, disabled | `role=toolbar`; every control labelled; buttons never steal editor selection | v1.6: rewrites Markdown syntax at selection; undo/redo included |
| `<ArchiveNoteView>` | `noteKey`, `folders` | loading, read-only, missing, restore dialog, delete confirm | Read-only banner `role=status`; delete behind named confirmation | `SCREEN-008` v1.6; actions: restore/copies/delete |
| `<MarkdownPreview>` | `html`, `loading` | loading, ready, blocked-image, render-error | Semantic rendered headings/lists; safe link labels | Server-sanitized HTML only |
| `<PlainTextViewer>` | `content`, `readOnly` | loading, ready, unsupported-encoding, oversized | Literal text; read-only reason announced | No Markdown controls |
| `<SaveState>` | `saved|unsaved|saving|conflict|error` | all named states | `role=status`; icon + text; no color-only state | `WF-006` |
| `<ConflictPanel>` | `kind: changed|source-missing`; `resolving` | conflict, resolving, error | `role=alert`; explicit actions; confirmation for reload | `SCREEN-006`, `WF-007` |
| `<MoveNotePanel>` | `folders`, `destination`, `error` | loading, selecting, validating, collision, success | Drawer/dialog with folder tree and field error | `WF-008` |
| `<ArchiveDialog>` | `collision`, `replacementName` | confirm, archiving, collision, error | Destructive naming; focus stays on recovery action | `WF-009` |
| `<SettingsForm>` | `config`, `errors`, `saving` | loading, ready, invalid, saving, error, success | Grouped fields; first invalid focus; status message | `SCREEN-003`, `WF-010` |
| `<ReadOnlyBanner>` | `reason: oversized|encoding|permission` | visible, retryable error | `role=status` or alert by severity; reason text | Mutation controls disabled |
| `<SearchRecoveryPanel>` | `status`, `onRebuild` | degraded, rebuilding, ready, failed | Progress/status announcement; editing-available copy | `SCREEN-007`, `WF-011` |
| `<PaneDivider>` | `orientation: vertical`; `pane: folder|notes`; `width`, `min`, `max`, `collapsed` | default, hover, dragging, focus, disabled, collapsed | `role=separator`; `aria-orientation="vertical"`; `aria-valuenow`/`min`/`max`; arrow-key resize, `Home`/`End` snap; `Enter`/double-click toggles collapse (prior width restored, session-only); collapsed pane renders `layout-rail-collapsed` `28px` rail with focusable expand affordance (`aria-expanded=false`) | `REQ-034`, `WF-012`; disabled below `desktop` breakpoint; reuses `border-subtle`/`border-strong`/`focus` tokens, no new color. Collapse extension: user-approved 2026-07-04 |
| `<FindInNoteBar>` | `query`, `matchIndex`, `matchCount`, `caseSensitive` | idle, searching, match, no-match, closed | `role="search"` landmark; `role="status"` live region for match count; `Escape` closes and returns focus | `REQ-035`, `WF-013`; shared shell over CodeMirror search (source mode) / ProseMirror decoration (visual mode) |
| `<ErrorState>` | `title`, `message`, `requestId?`, `actions` | recoverable, blocking | Heading, alert semantics, retry/back | Missing note/API/config errors |
| `<ConfirmationDialog>` | `tone`, `confirmLabel`, `details` | open, submitting, error | Initial focus on safe action; explicit consequence | External URL, reload, archive |
| `<CliErrorPresenter>` | `kind: lock|port|config|startup` | blocking, stale-recovery-failed | Terminal text only; stable exit copy | `SCREEN-004/005`; not React UI |

### 9.3 Primitive Coverage Matrix

| Source ID | Surface/workflow | Required primitive | Covered by | Status |
|---|---|---|---|---|
| `SCREEN-001` | Dashboard | `<AppShell>`, `<FolderTree>`, `<DashboardToolbar>`, `<NotesVirtualList>`, `<EmptyState>` | App shell + §9 | Covered |
| `SCREEN-002` | Note Workspace | `<EditorHeader>`, editors, preview, save state, Focus Mode, status | App shell + §9 | Covered |
| `SCREEN-003` | Settings | `<SettingsForm>`, `<FormField>`, `<Select>`, `<Switch>`, `<Modal>` | App shell + §9 | Covered |
| `SCREEN-004` | Workspace Lock Error | `<CliErrorPresenter>` | §9 contract | Covered |
| `SCREEN-005` | Startup Error | `<CliErrorPresenter>`, `<ErrorState>` | Launch + §9 contract | Covered |
| `SCREEN-006` | External Change Conflict | `<ConflictPanel>`, `<ConfirmationDialog>`, `<SaveState>` | App shell + §9 | Covered |
| `SCREEN-007` | Search Recovery | `<SearchRecoveryPanel>`, `<Button>`, `<ErrorState>` | §9 contract | Covered |
| `WF-001` | Discover notes | `<Skeleton>`, `<NotesVirtualList>`, `<EmptyState>`, `<ErrorState>` | §9 | Covered |
| `WF-002` | Search notes | `<DashboardToolbar>`, `<SearchResult>`, `<Pagination>`, `<EmptyState>` | App shell + §9 | Covered |
| `WF-003` | Create note | `<Modal>`, `<FormField>`, `<Input>`, `<Select>` | App shell | Covered |
| `WF-004` | Sort notes | `<DashboardToolbar>`, `<Select>`, `<IconButton>` | App shell + §9 | Covered |
| `WF-005` | Open note | `<Skeleton>`, `<NoteWorkspace>`, `<ReadOnlyBanner>`, `<ErrorState>` | App shell + §9 | Covered |
| `WF-006` | Edit/autosave | Editors, `<SaveState>`, `<Toast>`, `<ErrorState>` | App shell + §9 | Covered |
| `WF-007` | Resolve conflict | `<ConflictPanel>`, `<ConfirmationDialog>` | App shell | Covered |
| `WF-008` | Move note | `<MoveNotePanel>`, `<Drawer>`, `<FolderTree>` | §9 contract | Covered |
| `WF-009` | Archive note | `<ArchiveDialog>`, `<ConfirmationDialog>`, `<FormField>` | App shell + §9 | Covered |
| `WF-010` | Change settings | `<SettingsForm>`, form primitives, `<Toast>` | App shell | Covered |
| `WF-011` | Rebuild search | `<SearchRecoveryPanel>`, `<Button>`, `<SaveState>` | §9 contract | Covered |
| `WF-012` | Resize/collapse panes | `<PaneDivider>` | §9 | Documented — visual proof pending Step 11/14 |
| `WF-013` | Find in note | `<FindInNoteBar>` | §9 | Documented — visual proof pending Step 11/14 |
| `REQ-036` | Copyable text inline affordance | `<IconButton>` (existing, new usage) | §9 | Documented — visual proof pending Step 11/14 |

## 10. Page Inventory

| Route/screen | Primitives | Primary user | Responsive notes |
|---|---|---|---|
| Launch/empty workspace (`REQ-001/002`) | `<NavBar>`, `<WorkspaceLaunchPanel>`, `<Button>`, `<Modal>`, `<StatusBar>`, `<UnsupportedViewport>` | Local Operator | Full at >=`1024x640`; resize guidance below |
| `/` / `SCREEN-001` | `<AppShell>`, `<FolderTree>`, `<DashboardToolbar>`, `<NotesVirtualList>`, list items, states | Local Operator | `220/320/editor`; `190/280/editor` at 1024-1199 |
| `/notes/:noteKey` / `SCREEN-002` | Editor header/modes, editors, preview, save/conflict/read-only/focus primitives | Local Operator | Split collapses to equal minmax columns at compact desktop; Focus Mode full width |
| `/settings` / `SCREEN-003` | `<SettingsForm>`, form primitives, `<Modal>`/page section | Local Operator | Dialog width capped to viewport; desktop full workflow only |
| CLI / `SCREEN-004` | `<CliErrorPresenter>` | Local Operator | Terminal output; no browser layout |
| CLI/bootstrap / `SCREEN-005` | `<CliErrorPresenter>` or `<ErrorState>` | Local Operator | Blocking error remains readable at resize-guidance sizes |
| Conflict panel / `SCREEN-006` | `<ConflictPanel>`, `<ConfirmationDialog>`, `<SaveState>` | Local Operator | Actions remain visible in standard and Focus Mode |
| `/recovery/search` / `SCREEN-007` | `<SearchRecoveryPanel>`, `<ErrorState>`, `<Button>`, progress/status | Local Operator | Centered compact panel inside supported desktop shell |

### 10.1 Visual QA Evidence

| Surface | Viewport | Evidence | Console | Horizontal overflow | Result |
|---|---:|---|---|---|---|
| Launch | `375x720` | `.qa/parity-audit/wave-00/launch-375x720.png` | Clean | None | Resize guidance |
| Launch | `768x720` | `.qa/parity-audit/wave-00/launch-768x720.png` | Clean | None | Resize guidance |
| Launch | `1024x640` | `.qa/parity-audit/wave-00/launch-1024x640.png` | Clean | None | Minimum desktop |
| Launch | `1280x720` | `.qa/parity-audit/wave-00/launch-1280x720.png` | Clean | None | Primary target |
| Launch | `1536x900` | `.qa/parity-audit/wave-00/launch-1536x900.png` | Clean | None | Wide target |
| App shell | `360x720` | `.qa/parity-audit/wave-00/app-shell-360x720.png` | Clean | None | Resize guidance |
| App shell | `390x720` | `.qa/parity-audit/wave-00/app-shell-390x720.png` | Clean | None | Resize guidance |
| App shell | `768x720` | `.qa/parity-audit/wave-00/app-shell-768x720.png` | Clean | None | Resize guidance |
| App shell | `1024x640` | `.qa/parity-audit/wave-00/app-shell-focus-1024x640.png` | Clean | None | Focus Mode minimum |
| App shell | `1280x720` | `.qa/parity-audit/wave-00/app-shell-1280x720.png` | Clean | None | Standard shell |
| App shell | `1536x900` | `.qa/parity-audit/wave-00/app-shell-1536x900.png` | Clean | None | Wide shell |

## 11. Accessibility

- WCAG 2.1 AA floor; WCAG 2.2 AA target where applicable.
- Contrast: `4.5:1` normal text; `3:1` large text and meaningful non-text UI. Decorative separators may be lower only when not sole state indicator.
- Focus indicator: `2px` `focus`, `1px` offset; never removed.
- Keyboard order: titlebar -> folder pane -> note pane -> editor header -> editor content -> status actions; hidden panes leave order in Focus Mode.
- Shortcuts: `Ctrl+K` command palette; `Ctrl+P` search; `Ctrl+N` create; `Ctrl+,` settings; `Ctrl+\` split; `Ctrl+Shift+F` Focus Mode; `Escape` closes transient layer or exits Focus Mode when no modal is open.
- Dialogs trap focus, restore trigger focus, and use labelled titles/descriptions.
- Save/conflict/error states use text + icon + color; live regions avoid duplicate announcements.
- Desktop pointer controls may use `28px`-`34px` native-tool density. Any touch-targeted control uses minimum `44x44px`; mobile/tablet workflows remain unsupported.
- At 200% zoom, supported workflow may require viewport enlargement but must not overlap, clip core actions, or page-scroll horizontally at contract size.
- Reduced motion sets transition duration to `0.01ms`; visibility and state copy remain.
- Markdown preview preserves heading/list/table semantics; blocked links/images explain cause without loading resource.

## 12. Implementation Rules

- Port tokens to Tailwind v4 CSS `@theme` without semantic transformation. Tailwind 3 fallback uses `theme.extend`.
- CSS theme keys use table keys directly: `--color-*`, `--font-*`, `--text-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `--duration-*`, `--ease-*`, `--z-*`.
- No raw hex/rgb/hsl in component class strings or feature CSS. Token-definition files only.
- Primitive targets: `src/frontend/components/ui/*`; app composition: `src/frontend/components/*`; editors: `src/frontend/editor/*`.
- Compose screens from §9 primitives before adding new primitive.
- Primitive Extension Protocol: add typed primitive -> update §9 + §10 + coverage matrix -> bump version -> reference in PR description.
- Use Radix behavior patterns/project-owned wrappers where native HTML cannot satisfy focus, dismissal, or ARIA behavior. Do not add a runtime UI kit without dependency approval.
- No external assets, fonts, telemetry, analytics, or non-loopback requests.
- Use `min-height:100dvh`; never `h-screen`.
- Supported responsive verification: `1024x640`, `1280x720`, `1440x900`, `1536x900`.
- Unsupported guidance verification: `360x720`, `390x720`, `768x720`.
- Data primitives define loading, empty, partial error, full error, success, overflow, and retry behavior.
- Virtual lists preserve selected key, keyboard focus, query, sort, and scroll during append/update.
- Focus Mode is UI state only, not persisted configuration; route change resets standard layout.
- Visual parity source: `.claude-design/project/index.html` + `.claude-design/project/app-shell.html`.

## 13. Do / Don't

| Do | Don't |
|---|---|
| Keep notes/editor as strongest visual area (`PRODUCT.md`) | Turn workspace into marketing page or analytics dashboard |
| Use warm graphite + one amber accent (approved prototype) | Add neon, cool cyan, purple, gradients, or glass |
| Use dividers and pane contrast for hierarchy (Quiet Workbench) | Wrap every section in elevated cards |
| Preserve familiar desktop controls and shortcuts (`PRODUCT.md`) | Replace standard affordances with novel gesture-only controls |
| Keep motion short and state-driven (`REQ-030`) | Add ornamental loops, parallax, or layout animation |
| Show explicit save/conflict/error text (`REQ-017/018`) | Communicate safety state through color alone |
| Keep source and plain-text editors mono and lossless (`REQ-015/016`) | Apply serif/editorial styling to source content |
| Keep remote resources blocked until explicit action (`REQ-014/026`) | Load remote images, fonts, scripts, or previews |
| Use Focus Mode to remove navigation while preserving note tools (user requirement; `REQ-015`) | Hide save state, conflict actions, title, or exit control in Focus Mode |
| Show resize guidance below supported minimum (`REQ-031`) | Build partial mobile/tablet workflows or horizontal-scroll desktop UI |
| Use local system fonts for offline startup (`REQ-026`) | Depend on webfont availability |
| Preserve dense metadata hierarchy with readable contrast (approved prototype) | Use tiny text for critical instructions or error recovery |

## 14. Production Checklist

- [x] Exact required sections present; version/date/status set.
- [x] Design Intake Snapshot and Direction Decision recorded.
- [x] Brand, neutral, semantic, state, focus, type, spacing, radius, elevation, motion, z-index tokens complete.
- [x] Color tokens include role, Tailwind key, contrast notes, source/banned-use context.
- [x] No pure black/white UI canvas, neon gradient, glass, unresolved placeholder, or remote asset dependency.
- [x] Foundation and project primitive states, keyboard, ARIA, and responsive contracts documented.
- [x] `SCREEN-001`-`SCREEN-007` mapped.
- [x] `WF-001`-`WF-011` mapped; no missing primitive.
- [x] Loading, empty, partial error, full error, success, conflict, read-only, and retry states covered.
- [x] WCAG floor, focus, contrast, reduced motion, keyboard, and target-size rules documented.
- [x] Supported/unsupported viewport behavior and Focus Mode verified without horizontal overflow.
- [x] Asset performance/offline policy documented.
- [x] Step 11 implementation paths and anti-drift rules documented.
- [x] PRD/MasterPrompt aligned with Focus Mode before lock.
- [x] v1.4: light palette (`data-theme="light"`) contrast-verified (§2.6); `wide` editor width `90ch` (§3.3); `layout-rail-collapsed` `28px` (§4.1); `<PaneDivider>` collapse contract (§9.2).
- [x] v1.5: resize/collapse active at every supported width `>=1024px` (§4.3, user feedback round 1); `<SplitDivider>` editor/preview split resizer - drag/arrow keys, fraction `0.2..0.8`, double-click reset, session-only (§9.2 addendum).
- [x] v1.6 (user feedback round 2): modes Read/Source/Split - `<VisualMarkdownEditor>` removed, `<MarkdownToolbar>` added to `<SourceEditor>` (§9.2); card view + `<NoteCard>` + toolbar view toggle removed; editor width setting and line-length cap removed entirely - content fills the pane (§3.3, round 2b); `syntax-accent` token pair for source-editor heading/link contrast on code surfaces (§2.2); `<ArchiveNoteView>` for `SCREEN-008` with read-only banner, restore dialog, recycle-bin delete confirmation.
