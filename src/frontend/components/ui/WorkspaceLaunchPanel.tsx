import { CheckIcon, DocumentIcon, FolderAddIcon, LockIcon } from "../icons";
import { Button } from "./Button";

/*
 * <WorkspaceLaunchPanel> per Design_System.md 9.2: launch prototype adaptation.
 * Visual parity source: .claude-design/project/index.html welcome card.
 * Interactions are mock at Step 11 - real workspace flow lands at Step 12+.
 */
interface WorkspaceLaunchPanelProps {
  onChooseFolder: () => void;
  onUseDefault: () => void;
}

function DocumentStack() {
  return (
    <div aria-hidden="true" className="relative mt-1 h-21.5 w-18.5">
      <div className="absolute top-0 left-0 h-18 w-14.5 -rotate-5 rounded-sm border border-border-strong bg-surface-raised opacity-45" />
      <div className="absolute top-1.5 left-2 h-18 w-14.5 rotate-3 rounded-sm border border-border-strong bg-surface-raised opacity-70" />
      <div className="launch-doc-front absolute top-2.5 left-1 flex h-18 w-14.5 flex-col gap-1.5 rounded-sm border bg-surface-raised px-3 py-4">
        <span className="h-0.5 w-[58%] rounded-full bg-accent opacity-90" />
        <span className="h-0.5 w-full rounded-full bg-text-muted opacity-55" />
        <span className="h-0.5 w-full rounded-full bg-text-muted opacity-55" />
        <span className="h-0.5 w-full rounded-full bg-text-muted opacity-55" />
      </div>
    </div>
  );
}

const trustItems = [
  {
    icon: <CheckIcon size={16} />,
    title: "Files stay local",
    copy: "No account, cloud sync, or telemetry.",
  },
  {
    icon: <DocumentIcon size={16} />,
    title: "Open formats",
    copy: "Works directly with .md and .txt files.",
  },
  {
    icon: <LockIcon size={16} />,
    title: "Offline after install",
    copy: "Runs from your browser on 127.0.0.1.",
  },
] as const;

export function WorkspaceLaunchPanel({ onChooseFolder, onUseDefault }: WorkspaceLaunchPanelProps) {
  return (
    <section
      aria-labelledby="welcome-title"
      className="launch-welcome w-[min(680px,100%)] rounded-panel border border-border-subtle"
    >
      <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-7 px-10 pt-9.5 pb-8.5">
        <DocumentStack />
        <div>
          <span className="text-xs font-heading tracking-eyebrow text-text-muted uppercase">
            Start local
          </span>
          <h1
            id="welcome-title"
            className="m-0 text-display-sm font-heading tracking-title text-text-primary"
          >
            Open your notes folder
          </h1>
          <p className="mt-2.5 max-w-[50ch] text-body text-text-secondary">
            Choose an existing folder or create a new one. Local Notes reads and writes standard
            Markdown and text files directly on your device.
          </p>
          <div className="mt-6 flex items-center gap-2.5">
            <Button variant="primary" onClick={onChooseFolder}>
              <FolderAddIcon size={15} />
              Choose folder
            </Button>
            <Button onClick={onUseDefault}>Use default workspace</Button>
            <span className="ml-0.5 font-mono text-xs text-text-muted">Ctrl+O</span>
          </div>
        </div>
      </div>
      <div aria-label="Local Notes guarantees" className="grid grid-cols-3 border-t border-border-subtle">
        {trustItems.map((item, index) => (
          <div
            key={item.title}
            className={[
              "grid min-w-0 grid-cols-[22px_minmax(0,1fr)] gap-2 px-4.5 py-4",
              index > 0 ? "border-l border-border-subtle" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="mt-px text-success">{item.icon}</span>
            <div>
              <strong className="block text-sm font-medium text-text-primary">{item.title}</strong>
              <span className="mt-1 block text-xs leading-snug text-text-muted">{item.copy}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
