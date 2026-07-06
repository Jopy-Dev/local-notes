import type { ChangeEventHandler } from "react";

/*
 * <Switch> per Design_System.md 9.1: native checkbox semantics, visible label
 * provided by caller (sr-only inside). Track = radius-switch (5).
 */
interface SwitchProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

export function Switch({ label, checked, disabled, onChange }: SwitchProps) {
  return (
    <label className="relative h-4.5 w-8.5 shrink-0 cursor-pointer">
      <span className="sr-only">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer absolute h-px w-px opacity-0"
      />
      <span
        aria-hidden="true"
        className={[
          "absolute inset-0 rounded-switch border transition-colors duration-(--duration-standard) ease-standard",
          checked ? "border-accent bg-accent-muted" : "border-border-strong bg-surface-input",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
        ].join(" ")}
      />
      <span
        aria-hidden="true"
        className={[
          "absolute top-1 left-1 h-2.5 w-2.5 rounded-pill transition-transform duration-(--duration-standard) ease-standard",
          checked ? "translate-x-4 bg-text-primary" : "bg-text-muted",
        ].join(" ")}
      />
    </label>
  );
}
