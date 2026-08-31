import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room, RoomEvent, Track, VideoPresets,
} from "livekit-client";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Manages a LiveKit Room connection.
 * mode="participant": publishes camera+mic + exposes toggle helpers
 * mode="spectator":   subscribe-only
 * tokenEndpoint: override the token-minting route (defaults to the public
 * debate endpoints) — private calls (lib/privateCall usage in PrivateChat)
 * pass their own isolated endpoint here. The connection/track-handling
 * logic itself has no AI coupling either way, so this is pure reuse, not a
 * shortcut through anything that needs to stay isolated.
 */
export function useLiveKit({ roomId, mode, enabled = true, tokenEndpoint }) {
  const [status, setStatus] = useState("idle");
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [localVideoEl, setLocalVideoEl] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const roomRef = useRef(null);

  useEffect(() => {
    if (!enabled || !roomId) return;
    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: VideoPresets.h540.resolution },
    });
    roomRef.current = room;

    const upsertParticipant = (identity, patch) => {
      setRemoteParticipants((prev) => {
        const idx = prev.findIndex((p) => p.identity === identity);
        if (idx === -1) return [...prev, { identity, ...patch }];
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      });
    };
    const removeParticipant = (identity) => {
      setRemoteParticipants((prev) => prev.filter((p) => p.identity !== identity));
    };

    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      const el = track.attach();
      el.autoplay = true;
      el.playsInline = true;
      if (track.kind === Track.Kind.Video) {
        el.className = "w-full h-full object-cover";
        upsertParticipant(participant.identity, {
          name: participant.name || participant.identity,
          videoEl: el,
          hasVideo: true,
          // Seed from the publication's actual current state — previously
          // only later Mute/Unmute *events* updated this, so a spectator
          // joining after a participant had already muted saw them as
          // unmuted (no badge) until the next toggle.
          videoMuted: !!pub?.isMuted,
        });
      } else {
        upsertParticipant(participant.identity, {
          name: participant.name || participant.identity,
          audioEl: el,
          audioMuted: !!pub?.isMuted,
        });
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
      track.detach().forEach((el) => el.remove());
      if (track.kind === Track.Kind.Video) {
        upsertParticipant(participant.identity, { videoEl: null, hasVideo: false });
      }
    });
    room.on(RoomEvent.TrackMuted, (pub, participant) => {
      if (pub.kind === Track.Kind.Video) upsertParticipant(participant.identity, { videoMuted: true });
      if (pub.kind === Track.Kind.Audio) upsertParticipant(participant.identity, { audioMuted: true });
    });
    room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
      if (pub.kind === Track.Kind.Video) upsertParticipant(participant.identity, { videoMuted: false });
      if (pub.kind === Track.Kind.Audio) upsertParticipant(participant.identity, { audioMuted: false });
    });
    // Belt-and-suspenders for re-enabling the camera (toggleCamera below):
    // setCameraEnabled(true) has to re-acquire the device and publish a new
    // track from scratch, not just flip a flag, and on real hardware
    // (especially phones) that can take longer than the fast path assumes.
    // If toggleCamera's own synchronous check runs before the publication
    // is actually ready, localVideoEl would stay null — camEnabled flips to
    // true but the tile keeps showing the "camera off" placeholder. This
    // reacts to the actual publish event instead of a single well-timed
    // check, so it still recovers even if that race is lost.
    room.on(RoomEvent.LocalTrackPublished, (pub) => {
      if (pub.source !== Track.Source.Camera || !pub.videoTrack) return;
      const el = pub.videoTrack.attach();
      el.className = "w-full h-full object-cover";
      el.muted = true;
      el.playsInline = true;
      setLocalVideoEl(el);
    });
    room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
      if (pub.source !== Track.Source.Camera) return;
      setLocalVideoEl(null);
    });
    room.on(RoomEvent.ParticipantDisconnected, (p) => removeParticipant(p.identity));
    room.on(RoomEvent.Disconnected, () => {
      // LiveKit's own client already retries transient network blips
      // internally (RoomEvent.Reconnecting/Reconnected) — this only fires
      // once it's given up or the server ended the session. Previously left
      // status at "idle" (indistinguishable from "never connected") with
      // stale remote tiles still on screen and zero indication anything had
      // gone wrong. There's no safe automatic rejoin from here (the token
      // may need refreshing, the room may be gone) — surface it clearly
      // instead of leaving the call frozen and silent.
      if (cancelled) return;
      setStatus("disconnected");
      setRemoteParticipants([]);
      setLocalVideoEl(null);
      if (mode === "participant") toast.error("Video call disconnected. Reload to rejoin.");
    });

    (async () => {
      try {
        setStatus("connecting");
        const endpoint = tokenEndpoint || (mode === "participant" ? "/livekit/participant-token" : "/livekit/spectator-token");
        const { data } = await api.post(endpoint, { room_id: roomId });
        if (cancelled) return;
        await room.connect(data.server_url, data.participant_token);
        if (cancelled) { room.disconnect(); return; }
        if (mode === "participant") {
          try {
            await room.localParticipant.enableCameraAndMicrophone();
            const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
            const track = camPub?.videoTrack;
            if (track) {
              const el = track.attach();
              el.className = "w-full h-full object-cover";
              el.muted = true;
              el.playsInline = true;
              setLocalVideoEl(el);
            }
            setMicEnabled(true);
            setCamEnabled(true);
          } catch {
            toast.warning("Camera/mic denied — you'll appear as audio-off.");
            setMicEnabled(false);
            setCamEnabled(false);
          }
        }
        setStatus("connected");
      } catch {
        if (!cancelled) {
          setStatus("error");
          if (mode === "participant") toast.error("Video connection failed. Text still works.");
        }
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
      setRemoteParticipants([]);
      setLocalVideoEl(null);
    };
  }, [roomId, mode, enabled, tokenEndpoint]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicEnabled(next);
    } catch (e) {
      toast.error("Couldn't toggle microphone");
    }
  }, [micEnabled]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamEnabled(next);
      if (!next) {
        setLocalVideoEl(null);
      } else {
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        const track = camPub?.videoTrack;
        if (track) {
          const el = track.attach();
          el.className = "w-full h-full object-cover";
          el.muted = true;
          el.playsInline = true;
          setLocalVideoEl(el);
        }
      }
    } catch {
      toast.error("Couldn't toggle camera");
    }
  }, [camEnabled]);

  return {
    status, remoteParticipants, localVideoEl,
    micEnabled, camEnabled, toggleMic, toggleCamera,
    room: roomRef.current,
  };
}

/** Attach a live media element into a container div. Not currently used
 * anywhere, but clones rather than appendChild(el) directly on purpose —
 * see components/VideoStage.jsx's MediaMount for why: appendChild moves the
 * real DOM node, so if this element is ever also mounted elsewhere (the
 * same el rendered by more than one consumer at once), whichever mounts
 * last silently steals it from the other. Confirmed live as a real bug in
 * MediaMount's original version, not a theoretical one. */
export function AttachedMedia({ el, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const container = ref.current;
    if (!container || !el) return;
    container.innerHTML = "";
    const clone = document.createElement(el.tagName);
    clone.srcObject = el.srcObject;
    clone.autoplay = true;
    clone.playsInline = true;
    clone.muted = el.muted;
    clone.className = el.className;
    container.appendChild(clone);
    clone.play().catch(() => {}); // autoplay property alone isn't reliable here — see MediaMount
    return () => { if (container) container.innerHTML = ""; };
  }, [el]);
  return <div ref={ref} className={className} />;
}
