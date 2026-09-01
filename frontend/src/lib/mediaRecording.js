// Shared between RecordClipModal (Claims) and ChatRoom (debate self-
// recording, see backend/app/routers/rooms.py's upload_recording_chunk
// docstring for why chunked self-recording exists at all — the free
// workaround for not paying for LiveKit Egress).
export function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
}
