import open from "open";
import { LOCAL_ORIGIN } from "../shared/constants/server.js";

/*
 * Browser launch (MasterPrompt.md 4.1). Capability travels once via URL
 * fragment; bootstrap script moves it to sessionStorage and strips it.
 * Launch failure keeps the process alive and prints the one-time URL -
 * terminal copy is sensitive until process exit (ADR-003 residual risk).
 */
export function buildLaunchUrl(capability: string): string {
  return `${LOCAL_ORIGIN}/#access=${capability}`;
}

export async function openBrowser(url: string): Promise<boolean> {
  try {
    await open(url);
    return true;
  } catch {
    return false;
  }
}
