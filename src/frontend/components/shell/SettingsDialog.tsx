import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { getWorkspaceDisplayPath } from "../../services/workspace";
import { useSettingsData } from "../../stores/settingsData";
import { Button } from "../ui/Button";
import { FieldNote, FormField } from "../ui/FormField";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import {
  FONT_SIZES,
  LINE_HEIGHTS,
  THEMES,
  changedFields,
  draftFrom,
  themeByLabel,
} from "./settings-form-model";
import type { AppearanceDraft } from "./settings-form-model";

/*
 * Settings form (SCREEN-003 / WF-010, REQ-021/022). Fields mirror the ConfigV1
 * appearance schema; Apply sends only changed fields. Theme previews
 * optimistically on selection and rolls back on cancel or persistence failure
 * (MasterPrompt 6.2 - optimistic theme only). Workspace path is read-only.
 */
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="[&+&]:mt-6 [&+&]:border-t [&+&]:border-border-subtle [&+&]:pt-5">
      <h3 className="mb-3 text-sm font-heading text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export function SettingsDialog({ open, onClose, onApplied }: SettingsDialogProps) {
  const { config, saving, fieldErrors, apply, setPreviewTheme, clearErrors } = useSettingsData();
  const [draft, setDraft] = useState<AppearanceDraft | null>(null);

  // Fresh draft per open; discard preview + errors on close (rollback).
  useEffect(() => {
    if (open && config) setDraft(draftFrom(config));
    if (!open) {
      setDraft(null);
      setPreviewTheme(null);
      clearErrors();
    }
    // Store actions are referentially stable.
  }, [open, config]);

  if (!config || !draft) {
    return (
      <Modal open={open} title="Settings" description="Loading current settings." onClose={onClose}>
        <p aria-busy="true" className="py-6 text-sm text-text-muted">
          Loading settings from the local server.
        </p>
      </Modal>
    );
  }

  const errorProps = (field: string): { error: string } | Record<string, never> => {
    const message = fieldErrors?.[field]?.[0];
    return message === undefined ? {} : { error: message };
  };
  const formError = fieldErrors?.["settings"]?.[0];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!config || !draft) return;
    const partial = changedFields(config, draft);
    if (Object.keys(partial).length === 0) {
      onClose();
      return;
    }
    if (await apply(partial)) onApplied();
  }

  return (
    <Modal
      open={open}
      title="Settings"
      description="Changes apply locally without restarting."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="settings-form" loading={saving}>
            Apply settings
          </Button>
        </>
      }
    >
      <form id="settings-form" noValidate onSubmit={(event) => void onSubmit(event)}>
        <SettingsSection title="Appearance">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Theme" {...errorProps("theme")}>
              <Select
                options={THEMES.map((theme) => theme.label)}
                value={THEMES.find((theme) => theme.value === draft.theme)?.label ?? "System"}
                onChange={(event) => {
                  const next = themeByLabel(event.target.value);
                  setDraft({ ...draft, theme: next });
                  // Optimistic preview (WF-010); Apply persists, close reverts.
                  setPreviewTheme(next);
                }}
              />
            </FormField>
            <FormField label="Editor font size" {...errorProps("editorFontSize")}>
              <Select
                options={FONT_SIZES.map((size) => `${size} px`)}
                value={`${draft.editorFontSize} px`}
                onChange={(event) =>
                  setDraft({ ...draft, editorFontSize: Number.parseInt(event.target.value, 10) })
                }
              />
            </FormField>
            <FormField label="Line height" {...errorProps("lineHeight")}>
              <Select
                options={LINE_HEIGHTS.map((height) => height.toFixed(1))}
                value={draft.lineHeight.toFixed(1)}
                onChange={(event) => setDraft({ ...draft, lineHeight: Number.parseFloat(event.target.value) })}
              />
            </FormField>
          </div>
          {formError ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {formError}
            </p>
          ) : null}
        </SettingsSection>
        <SettingsSection title="Workspace">
          <FieldNote label="Active path">
            <div className="truncate rounded-control border border-border-subtle bg-surface-input px-2.5 py-2 font-mono text-2xs text-text-muted">
              {getWorkspaceDisplayPath() ?? config.workspace}
            </div>
          </FieldNote>
          <p className="mt-1.5 text-2xs leading-snug text-text-muted">
            Workspace switching is handled from the launch surface.
          </p>
        </SettingsSection>
      </form>
    </Modal>
  );
}
