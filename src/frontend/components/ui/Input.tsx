import type { InputHTMLAttributes, Ref } from "react";

/*
 * <Input> per Design_System.md 9.1: external label required (FormField or
 * sr-only), error association via aria-describedby, invalid via aria-invalid.
 */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  // React 19 ref-as-prop; InputHTMLAttributes does not carry it.
  ref?: Ref<HTMLInputElement>;
}

export function Input({ invalid = false, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={[
        "h-8.5 w-full rounded-control border bg-surface-input px-2.5 text-body text-text-primary",
        "placeholder:text-text-muted disabled:text-text-disabled",
        invalid ? "border-danger" : "border-border-subtle",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
