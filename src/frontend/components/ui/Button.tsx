import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

/*
 * <Button> per Design_System.md 9.1: variant primary|secondary|compact|danger,
 * size sm|md, loading. Accent reserved for primary.
 */
type ButtonVariant = "primary" | "secondary" | "compact" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // React 19 ref-as-prop passthrough (ConfirmationDialog safe-action focus).
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-medium " +
  "cursor-pointer transition-colors duration-(--duration-fast) ease-standard " +
  "active:translate-y-px disabled:cursor-default disabled:text-text-disabled";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-accent bg-accent text-accent-ink hover:border-accent-hover hover:bg-accent-hover",
  secondary:
    "border border-border-strong bg-surface-raised text-text-primary hover:bg-surface-hover",
  compact:
    "border border-transparent bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary",
  danger:
    "border border-border-strong bg-surface-raised text-danger hover:bg-danger-bg",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-7 px-2.5 text-sm",
  md: "min-h-9 px-3.5 text-ui",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={[base, variantClasses[variant], sizeClasses[size], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? <span className="sr-only">Loading</span> : null}
      {children}
    </button>
  );
}
