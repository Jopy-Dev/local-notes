import type { SelectHTMLAttributes } from "react";

/*
 * <Select> per Design_System.md 9.1: native select for MVP, visible label
 * wired by the caller (FormField or sr-only label).
 */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly string[];
  compact?: boolean;
}

export function Select({ options, compact = false, className, ...rest }: SelectProps) {
  return (
    <select
      className={[
        "min-w-0 cursor-pointer rounded-control border border-border-subtle bg-surface-input",
        compact ? "h-7 pr-6 pl-2 text-xs text-text-secondary" : "h-8.5 w-full px-2.5 text-ui text-text-primary",
        "disabled:cursor-default disabled:text-text-disabled",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}
