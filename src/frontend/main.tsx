import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { adoptCapabilityFromFragment } from "./services/token";
import "./styles/app.css";

// Move #access= capability to sessionStorage and strip the fragment BEFORE
// first render/API request (MasterPrompt.md 4.1).
adoptCapabilityFromFragment();

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container #root missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
