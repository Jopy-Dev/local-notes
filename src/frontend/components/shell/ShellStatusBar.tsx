import { StatusBar, StatusItem, StatusSpacer } from "../ui/StatusBar";

// Shell status strip; live values wire to editor/config state at Step 12+.
export function ShellStatusBar() {
  return (
    <StatusBar>
      <StatusItem dot="success">Saved</StatusItem>
      <StatusItem mono>Projects/Local Notes/local-notes-architecture.md</StatusItem>
      <StatusSpacer />
      <StatusItem>Markdown</StatusItem>
      <StatusItem>UTF-8</StatusItem>
      <StatusItem>LF</StatusItem>
      <StatusItem>14 px</StatusItem>
      <StatusItem>Local only</StatusItem>
    </StatusBar>
  );
}
