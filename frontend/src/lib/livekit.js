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
 */
export function useLiveKit({ roomId, mode, enabled = true }) {
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

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      const el = track.attach();
      el.autoplay = true;
      el.playsInline = true;
      if (track.kind === Track.Kind.Video) {
        el.className = "w-full h-full object-cover";
        upsertParticipant(participant.identity, {
          name: participant.name || participant.identity,
          videoEl: el,
          hasVideo: true,
        });
      } else {
        upsertParticipant(participant.identity, {
          name: participant.name || participant.identity,
          audioEl: el,
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
    room.on(RoomEvent.ParticipantDisconnected, (p) => removeParticipant(p.identity));
    room.on(RoomEvent.Disconnected, () => setStatus("idle"));

    (async () => {
      try {
        setStatus("connecting");
        const endpoint = mode === "participant" ? "/livekit/participant-token" : "/livekit/spectator-token";
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
  }, [roomId, mode, enabled]);

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

/** Attach a live media element into a container div. */
export function AttachedMedia({ el, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = "";
    if (el) container.appendChild(el);
    return () => { if (container) container.innerHTML = ""; };
  }, [el]);
  return <div ref={ref} className={className} />;
}
