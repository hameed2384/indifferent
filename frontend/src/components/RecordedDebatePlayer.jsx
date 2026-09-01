import { useEffect, useRef, useState } from "react";

/** Playback for the free-tier self-recording workaround (see
 * backend/app/routers/rooms.py's upload_recording_chunk docstring): each
 * side is its own sequence of ~15s chunks, not one seamless file, and the
 * two sides were recorded independently by two different browsers with no
 * shared clock — so this deliberately doesn't try to keep them
 * frame-synced, just plays each side's own chunks back to back. A real,
 * accepted quality tradeoff versus a paid server-composited recording. */
function SidePlayer({ urls, label }) {
  const [idx, setIdx] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => { setIdx(0); }, [urls]);
  useEffect(() => { videoRef.current?.play().catch(() => {}); }, [idx]);

  if (!urls || urls.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center px-4 bg-[#111]">
        <div className="font-heading text-sm font-medium text-[var(--fg-muted)]">{label}</div>
        <div className="text-xs text-[var(--fg-subtle)] mt-1">No recording available</div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      key={urls[idx]}
      src={urls[idx]}
      autoPlay
      playsInline
      controls
      className="w-full h-full object-cover bg-black"
      data-testid="recorded-debate-video"
      onEnded={() => setIdx((i) => (i + 1 < urls.length ? i + 1 : i))}
    />
  );
}

export default function RecordedDebatePlayer({ recording, sideALabel, sideBLabel }) {
  // aspect-video (not h-full) on each tile deliberately — this renders in
  // both a fixed-pixel-height mobile wrapper AND a desktop Normal-mode
  // column with no resolved ancestor height at all (VideoStage's own tiles
  // use the same self-sizing trick for exactly that reason: a percentage
  // height here would collapse to zero in the desktop case).
  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      <div className="relative aspect-video rounded-lg overflow-hidden">
        <SidePlayer urls={recording?.a} label={sideALabel} />
      </div>
      <div className="relative aspect-video rounded-lg overflow-hidden">
        <SidePlayer urls={recording?.b} label={sideBLabel} />
      </div>
    </div>
  );
}
