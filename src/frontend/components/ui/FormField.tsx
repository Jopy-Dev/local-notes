import { useId } from "react";
import type { ReactElement, ReactNode } from "react";
import { cloneElement } from "react";

/*
 * <FormField> per Design_System.md 9.1: label/input/helper/error IDs wired.
 * Child input receives id + aria-describedby.
 */
interface FormFieldProps {
  label: string;
  helper?: string;
  error?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string }>;
}

export function FormField({ label, helper, error, children }: FormFieldProps) {
  const fieldId = useId();
  const helperId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;
  const describedBy =
    [helper ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="[&+&]:mt-4">
      <label htmlFor={fieldId} className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </label>
      {cloneElement(children, {
        id: fieldId,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      })}
      {helper ? (
        <p id={helperId} className="mt-1.5 text-2xs leading-snug text-text-muted">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-2xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FieldNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </div>
  );
}
