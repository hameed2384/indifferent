import { useEffect, useRef } from "react";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Escape-to-close + a basic focus trap for any modal/dialog overlay — none
 * of the app's modals had either before this. Returns a ref to attach to
 * the modal's outer container; combine with role="dialog" aria-modal="true"
 * on that same element. */
export function useModalA11y(onClose) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const focusable = () => Array.from(el.querySelectorAll(FOCUSABLE)).filter((n) => !n.disabled && n.offsetParent !== null);
    focusable()[0]?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") { onClose?.(); return; }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return ref;
}
