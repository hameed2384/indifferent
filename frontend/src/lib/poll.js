/**
 * setInterval that pauses while the tab is hidden and catches up the moment
 * it's visible again. Every poll is a billed serverless request, and a
 * forgotten background tab used to keep polling all day. Returns a cleanup
 * function (call it where you'd have called clearInterval).
 */
export function setVisibleInterval(fn, ms) {
  const tick = () => { if (!document.hidden) fn(); };
  const iv = setInterval(tick, ms);
  const onVisible = () => { if (!document.hidden) fn(); };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(iv);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
