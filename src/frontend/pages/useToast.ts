import { useEffect, useRef, useState } from "react";

// Toast visibility timer (2200ms target, Design_System.md 7).
const TOAST_VISIBLE_MS = 2200;

export function useToast() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function show(nextMessage: string) {
    clearTimeout(timer.current);
    setMessage(nextMessage);
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), TOAST_VISIBLE_MS);
  }

  return { message, visible, show };
}
