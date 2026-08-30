import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const MAX_SECONDS = 20;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CAPTION = 200;

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
}

/** Claim Trees' shared record/upload flow — used both for a brand-new root
 * claim (category picker shown) and a reply (category inherited silently
 * from the parent, per clips.py: only the root claim's category is ever
 * user-chosen). Recording is capped at MAX_SECONDS with a conservative
 * bitrate specifically so the result reliably clears MAX_BYTES — that cap
 * isn't arbitrary, it's what fits through a single Vercel serverless
 * request at all. */
export default function RecordClipModal({ categories, lockCategory, parentClipId, onClose, onPosted }) {
  const [category, setCategory] = useState(categories?.[0] || "");
  const [caption, setCaption] = useState("");
  const [mode, setMode] = useState("choose"); // choose | recording | preview
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [posting, setPosting] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!lockCategory && !category && categories?.length) setCategory(categories[0]);
  }, [categories, lockCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  };

  const startRecording = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 800_000,
        audioBitsPerSecond: 64_000,
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
        setBlob(recorded);
        setPreviewUrl(URL.createObjectURL(recorded));
        setMode("preview");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setMode("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) { stopRecording(); return MAX_SECONDS; }
          return s + 1;
        });
      }, 1000);
    } catch {
      setCameraError("Camera/mic access denied or unavailable — try uploading a file instead.");
    }
  };

  const onFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) { toast.error("That file is over 4MB — trim it down or record a shorter clip."); return; }
    setBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMode("preview");
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setMode("choose");
    setSeconds(0);
  };

  const submit = async () => {
    if (!blob) return;
    if (!caption.trim()) { toast.error("Say what your claim or rebuttal is"); return; }
    if (!lockCategory && !category) { toast.error("Pick a category"); return; }
    if (blob.size > MAX_BYTES) { toast.error("Clip is too large — keep it under 4MB"); return; }
    setPosting(true);
    try {
      const form = new FormData();
      form.append("caption", caption.trim());
      if (!lockCategory) form.append("category", category);
      if (parentClipId) form.append("parent_clip_id", parentClipId);
      const ext = (blob.type || "").includes("mp4") ? "mp4" : "webm";
      form.append("video", blob, `clip.${ext}`);
      const { data } = await api.post("/clips", form);
      toast.success("Posted.");
      onPosted(data.clip_id);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't post that clip");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="eyebrow">{lockCategory ? "Reply with video" : "State your claim"}</div>
        <h2 className="font-heading text-2xl font-semibold mt-2">{lockCategory ? "Make your case" : "What's your position?"}</h2>

        {mode === "choose" && (
          <div className="mt-6 space-y-3">
            <button onClick={startRecording} className="btn-accent w-full" data-testid="btn-record-clip">Record ({MAX_SECONDS}s max)</button>
            <button onClick={() => fileInputRef.current?.click()} className="btn-outline w-full" data-testid="btn-upload-clip">Upload a video file</button>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={onFileChosen} data-testid="clip-file-input" />
            {cameraError && <p className="text-xs text-[var(--danger)]">{cameraError}</p>}
          </div>
        )}

        {mode === "recording" && (
          <div className="mt-6">
            <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video" playsInline />
            <div className="mt-3 flex items-center justify-between">
              <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" /> {seconds}s / {MAX_SECONDS}s</span>
              <button onClick={stopRecording} className="btn-danger text-sm" data-testid="btn-stop-recording">Stop</button>
            </div>
          </div>
        )}

        {mode === "preview" && (
          <div className="mt-6">
            <video src={previewUrl} controls className="w-full rounded-lg bg-black aspect-video" />
            <button onClick={reset} className="btn-ghost text-xs mt-2" data-testid="btn-retake">Retake</button>
            <div className="mt-4 space-y-3">
              {!lockCategory && (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto" data-testid="clip-category-picker">
                  {(categories || []).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`py-2 rounded-lg border text-sm font-medium transition ${category === c ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]" : "bg-[var(--surface)] border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"}`}
                      data-testid={`clip-category-${c}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={lockCategory ? "What's your rebuttal?" : "State your claim in one line…"}
                maxLength={MAX_CAPTION}
                rows={2}
                className="textarea"
                data-testid="clip-caption-input"
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onClose} data-testid="clip-modal-cancel">Cancel</button>
          {mode === "preview" && (
            <button className="btn-accent" onClick={submit} disabled={posting} data-testid="btn-post-clip">
              {posting ? "Posting…" : "Post"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
