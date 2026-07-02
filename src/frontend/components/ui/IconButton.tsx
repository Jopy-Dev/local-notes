import type { ButtonHTMLAttributes, ReactNode } from "react";

/*
 * <IconButton> per Design_System.md 9.1: required accessible label,
 * aria-pressed for toggles, 28-32px desktop control density.
 */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  pressed?: boolean;
  children: ReactNode;
}

export function IconButton({ label, pressed, children, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={rest.title ?? label}
      aria-pressed={pressed}
      className={[
        "inline-grid h-7 w-7.5 place-items-center rounded-control border border-transparent",
        "bg-transparent text-text-secondary cursor-pointer",
        "transition-colors duration-(--duration-fast) ease-standard",
        "hover:bg-surface-hover hover:text-text-primary",
        "disabled:cursor-default disabled:text-text-disabled",
        pressed === true ? "bg-surface-selected text-text-primary" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
