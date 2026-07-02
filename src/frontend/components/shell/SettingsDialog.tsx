import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "../ui/Button";
import { FieldNote, FormField } from "../ui/FormField";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { Switch } from "../ui/Switch";
import { WORKSPACE_PATH } from "../../services/mockWorkspace";

/*
 * Settings dialog (SCREEN-003 / WF-010 surface). Options mirror ConfigV1
 * appearance schema (REQ-021); persistence wires to the settings API at Step 12+.
 */
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="[&+&]:mt-6 [&+&]:border-t [&+&]:border-border-subtle [&+&]:pt-5">
      <h3 className="mb-3 text-sm font-heading text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

function AppearanceSection() {
  return (
    <SettingsSection title="Appearance">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Theme">
          <Select options={["System", "Dark", "Light"]} />
        </FormField>
        <FormField label="Editor width">
          <Select options={["Narrow", "Medium", "Wide"]} defaultValue="Medium" />
        </FormField>
        <FormField label="Editor font size">
          <Select options={["13 px", "14 px", "15 px", "16 px"]} defaultValue="14 px" />
        </FormField>
        <FormField label="Line height">
          <Select options={["1.5", "1.6", "1.7"]} defaultValue="1.6" />
        </FormField>
      </div>
    </SettingsSection>
  );
}

function EditorSection() {
  const [autosave, setAutosave] = useState(true);

  return (
    <SettingsSection title="Editor">
      <div className="flex items-center justify-between gap-5">
        <div>
          <strong className="block text-xs text-text-secondary">Autosave</strong>
          <span className="mt-0.5 block text-2xs text-text-muted">
            Save after a short pause while editing.
          </span>
        </div>
        <Switch
          label="Enable autosave"
          checked={autosave}
          onChange={(event) => setAutosave(event.target.checked)}
        />
      </div>
    </SettingsSection>
  );
}

function WorkspaceSection() {
  return (
    <SettingsSection title="Workspace">
      <FieldNote label="Active path">
        <div className="truncate rounded-control border border-border-subtle bg-surface-input px-2.5 py-2 font-mono text-2xs text-text-muted">
          {WORKSPACE_PATH}
        </div>
      </FieldNote>
      <p className="mt-1.5 text-2xs leading-snug text-text-muted">
        Workspace switching is handled from the launch surface.
      </p>
    </SettingsSection>
  );
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
}

export function SettingsDialog({ open, onClose, onApply }: SettingsDialogProps) {
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    onApply();
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
          <Button variant="primary" type="submit" form="settings-form">
            Apply settings
          </Button>
        </>
      }
    >
      <form id="settings-form" onSubmit={onSubmit}>
        <AppearanceSection />
        <EditorSection />
        <WorkspaceSection />
      </form>
    </Modal>
  );
}
