import { Mic, MicOff, Video, VideoOff, LayoutGrid, Focus } from "lucide-react";

/** Video-view mode + participant device controls. */
export function VideoControls({
  viewMode,
  onViewModeChange,
  micEnabled,
  onToggleMic,
  camEnabled,
  onToggleCamera,
  spotlightIdentity,
  sides,
  onSpotlightChange,
}) {
  const isCinema = viewMode === "cinema";
  const showParticipantControls = typeof onToggleMic === "function";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* View mode toggle — hidden on mobile (mobile always uses spotlight layout) */}
      <div className="hidden md:inline-flex rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden">
        <button
          onClick={() => onViewModeChange("normal")}
          data-testid="view-mode-normal"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${!isCinema ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
          title="Normal view — equal tiles"
        >
          <LayoutGrid className="w-3.5 h-3.5" /> Normal
        </button>
        <button
          onClick={() => onViewModeChange("cinema")}
          data-testid="view-mode-cinema"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-l border-[var(--border-strong)] ${isCinema ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
          title="Cinema view — spotlight one speaker"
        >
          <Focus className="w-3.5 h-3.5" /> Cinema
        </button>
      </div>

      {/* Spotlight side selector — shown in cinema mode on desktop */}
      {isCinema && sides && sides.length > 0 && (
        <div className="hidden md:inline-flex rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden">
          {sides.map((s, i) => {
            const active = spotlightIdentity === s.identity;
            return (
              <button
                key={s.identity}
                onClick={() => onSpotlightChange(s.identity)}
                data-testid={`spotlight-${s.label?.toLowerCase().replace(/\s+/g, "-") || i}`}
                className={`px-3 py-1.5 text-xs font-medium ${i > 0 ? "border-l border-[var(--border-strong)]" : ""} ${active ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
                title={`Spotlight ${s.label}`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {showParticipantControls && (
        <div className="inline-flex rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden">
          <button
            onClick={onToggleMic}
            data-testid="btn-toggle-mic"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${micEnabled ? "text-[var(--fg)] hover:bg-[var(--bg-muted)]" : "bg-[var(--danger)] text-white"}`}
            title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {micEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{micEnabled ? "Mic" : "Muted"}</span>
          </button>
          <button
            onClick={onToggleCamera}
            data-testid="btn-toggle-camera"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-l border-[var(--border-strong)] ${camEnabled ? "text-[var(--fg)] hover:bg-[var(--bg-muted)]" : "bg-[var(--danger)] text-white"}`}
            title={camEnabled ? "Turn camera off" : "Turn camera on"}
          >
            {camEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{camEnabled ? "Cam" : "Off"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Renders video tiles. Two layouts:
 *   - Mobile (< md): Discord-style — mobileSpotlightTile fills, the other is a small PiP bottom-right
 *   - Desktop (>= md): honors viewMode
 *
 * `tiles`: [{ key, identity, label?, overlay?, videoEl, audioEl, audioMuted, placeholderTitle, placeholderSubtitle, placeholderFooter }]
 * `label` is a plain string used for tooltips (PiP swap button, spotlight picker);
 * `overlay`, if given, is a richer node rendered top-left instead of the plain
 * text badge (WatchRoom uses this for the viewer name/pic/follow chip).
 * `mobileSpotlightIdentity`: identity to spotlight on mobile (defaults to tiles[1] — usually the partner/remote)
 */
export function VideoStage({ tiles, viewMode, spotlightIdentity, onSpotlightChange, mobileSpotlightIdentity }) {
  const isCinema = viewMode === "cinema";
  const spot = tiles.find((t) => t.identity === spotlightIdentity) || tiles[0];
  // Every non-spotlighted tile stacks as a PiP — with only 2 tiles total this
  // is exactly one, but a 3-4 person group debate (party-queue, subscriber
  // join) must not silently drop the rest of the room from view.
  const others = tiles.filter((t) => t !== spot);

  // Mobile spotlight defaults to the last tile (usually the partner)
  const mobileSpot =
    tiles.find((t) => t.identity === mobileSpotlightIdentity) ||
    tiles.find((t) => t.key !== "local") ||
    tiles[tiles.length - 1] ||
    tiles[0];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Mobile: stacked, equal-height tiles (spotlight first) */}
      <div className="md:hidden flex-1 min-h-0 flex flex-col gap-2">
        {[mobileSpot, ...tiles.filter((t) => t !== mobileSpot)].map((t) => (
          <div key={t.key} className="flex-1 min-h-0 relative rounded-lg overflow-hidden">
            <VideoTile tile={t} fill />
          </div>
        ))}
      </div>

      {/* Desktop: normal grid or cinema layout */}
      <div className="hidden md:flex flex-1 min-h-0">
        {isCinema ? (
          <div className="relative w-full flex-1 min-h-0 rounded-lg overflow-hidden">
            <VideoTile tile={spot} fill />
            {others.length > 0 && (
              <div className="absolute bottom-3 right-3 flex flex-col gap-2 items-end">
                {others.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => onSpotlightChange?.(t.identity)}
                    className="group relative w-36 lg:w-48 aspect-video rounded-md overflow-hidden shadow-2xl ring-2 ring-white/60 hover:ring-[var(--accent)] transition"
                    title={`Spotlight ${t.label || "this participant"}`}
                    data-testid="pip-swap"
                  >
                    <VideoTile tile={t} compact />
                    <span className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:gap-4 w-full">
            {tiles.map((t) => <VideoTile key={t.key} tile={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/** `fill`: absolute inset-0 inside a flex parent; `compact`: small PiP */
function VideoTile({ tile, fill, compact }) {
  const containerCls = fill
    ? "absolute inset-0 bg-[#111]"
    : compact
      ? "w-full h-full bg-[#111]"
      : "relative aspect-video bg-[#111] rounded-lg overflow-hidden";
  return (
    <div className={containerCls}>
      {tile.videoEl ? (
        <MediaMount el={tile.videoEl} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-3">
          <div className={`font-heading font-semibold break-words ${compact ? "text-[10px]" : fill ? "text-2xl sm:text-3xl lg:text-4xl" : "text-xl sm:text-2xl md:text-3xl"}`}>
            {tile.placeholderTitle}
          </div>
          {!compact && tile.placeholderSubtitle && (
            <div className="text-[11px] font-mono-ui text-white/60 mt-1">{tile.placeholderSubtitle}</div>
          )}
          {!compact && tile.placeholderFooter && (
            <div className="mt-3 text-[11px] text-white/50">{tile.placeholderFooter}</div>
          )}
        </div>
      )}
      {tile.audioEl && <MediaMount el={tile.audioEl} className="hidden" />}
      {!compact && tile.overlay}
      {tile.label && !compact && !tile.overlay && (
        <div className="absolute top-2 left-2 text-[11px] font-medium bg-white/90 text-black px-2 py-0.5 rounded">
          {tile.label}
        </div>
      )}
      {compact && tile.label && (
        <div className="absolute top-1 left-1 text-[9px] font-medium bg-white/90 text-black px-1.5 py-0 rounded">
          {tile.label}
        </div>
      )}
      {tile.audioMuted && !compact && (
        <div className="absolute top-2 right-2 bg-[var(--danger)] text-white px-1.5 py-0.5 rounded text-[10px] font-medium">
          Muted
        </div>
      )}
    </div>
  );
}

function MediaMount({ el, className = "" }) {
  const ref = (node) => {
    if (!node) return;
    node.innerHTML = "";
    if (el) node.appendChild(el);
  };
  return <div ref={ref} className={`absolute inset-0 ${className}`} />;
}
