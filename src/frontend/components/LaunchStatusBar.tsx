import { StatusBar, StatusItem, StatusSpacer } from "./ui/StatusBar";

// Launch-surface status strip; server address is display copy at Step 11.
const LOCAL_ADDRESS = "127.0.0.1:8989";

export function LaunchStatusBar() {
  return (
    <StatusBar>
      <StatusItem dot="success">Local server ready</StatusItem>
      <StatusItem mono>{LOCAL_ADDRESS}</StatusItem>
      <StatusSpacer />
      <StatusItem>UTF-8</StatusItem>
      <StatusItem>Local only</StatusItem>
    </StatusBar>
  );
}
