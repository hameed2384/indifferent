import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useModalA11y } from "@/hooks/useModalA11y";

/** Live stream controls for whoever's broadcasting — title/description
 * editing (Go-Live rooms only, see rooms.py:update_room_info's own gating)
 * plus camera/mic device selection (any participant, LiveKit-side, no
 * backend call at all). Two unrelated concerns sharing one modal because
 * both are "things you'd want to tweak without leaving the call," not
 * because they're conceptually the same feature. */
export default function StreamSettingsModal({
  room, micEnabled, camEnabled, toggleMic, toggleCamera, switchDevice, onClose, onInfoSaved,
}) {
  const ref = useModalA11y(onClose);
  const canEditInfo = !!room.can_edit_info;

  const [title, setTitle] = useState(room.custom_title || "");
  const [description, setDescription] = useState(room.description || "");
  const [saving, setSaving] = useState(false);

  const [cameras, setCameras] = useState([]);
  const [mics, setMics] = useState([]);
  const [camDevice, setCamDevice] = useState("");
  const [micDevice, setMicDevice] = useState("");

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((d) => d.kind === "videoinput"));
        setMics(devices.filter((d) => d.kind === "audioinput"));
      } catch { /* permission not granted yet, or unsupported — leave empty */ }
    };
    loadDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices);
  }, []);

  const saveInfo = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { toast.error("Title can't be empty"); return; }
    setSaving(true);
    try {
      const { data } = await api.post(`/rooms/${room.room_id}/info`, {
        title: trimmedTitle, description: description.trim() || null,
      });
      toast.success("Stream info updated");
      onInfoSaved(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't update stream info");
    } finally {
      setSaving(false);
    }
  };

  const onCamChange = (id) => { setCamDevice(id); switchDevice("videoinput", id); };
  const onMicChange = (id) => { setMicDevice(id); switchDevice("audioinput", id); };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Stream settings" className="card w-full max-w-lg p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <div className="eyebrow">Stream settings</div>
        <h2 className="font-heading text-2xl font-semibold mt-2">Adjust your stream</h2>

        {canEditInfo && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs text-[var(--fg-subtle)]" htmlFor="settings-title">Title</label>
              <input
                id="settings-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="field mt-1"
                data-testid="settings-title-input"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--fg-subtle)]" htmlFor="settings-description">Description (optional)</label>
              <textarea
                id="settings-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                className="textarea mt-1"
                data-testid="settings-description-input"
              />
            </div>
            <button className="btn-outline text-sm" onClick={saveInfo} disabled={saving} data-testid="btn-save-stream-info">
              {saving ? "Saving…" : "Save title & description"}
            </button>
          </div>
        )}

        <div className={canEditInfo ? "mt-6 pt-6 border-t border-[var(--border)] space-y-4" : "mt-6 space-y-4"}>
          <div>
            <label className="text-xs text-[var(--fg-subtle)]" htmlFor="settings-camera">Camera</label>
            <select
              id="settings-camera"
              value={camDevice}
              onChange={(e) => onCamChange(e.target.value)}
              className="field mt-1"
              data-testid="settings-camera-select"
            >
              <option value="">System default</option>
              {cameras.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--fg-subtle)]" htmlFor="settings-mic">Microphone</label>
            <select
              id="settings-mic"
              value={micDevice}
              onChange={(e) => onMicChange(e.target.value)}
              className="field mt-1"
              data-testid="settings-mic-select"
            >
              <option value="">System default</option>
              {mics.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleMic}
              className={micEnabled ? "btn-outline text-sm" : "btn-danger text-sm"}
              data-testid="settings-toggle-mic"
            >
              {micEnabled ? "Mute mic" : "Unmute mic"}
            </button>
            <button
              onClick={toggleCamera}
              className={camEnabled ? "btn-outline text-sm" : "btn-danger text-sm"}
              data-testid="settings-toggle-cam"
            >
              {camEnabled ? "Turn camera off" : "Turn camera on"}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onClose} data-testid="settings-close">Close</button>
        </div>
      </div>
    </div>
  );
}
