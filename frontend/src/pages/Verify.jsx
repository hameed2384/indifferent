import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

export default function Verify() {
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("File too large (8MB max)"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/verify/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await checkAuth();
      toast.success("Verified. Welcome.");
      navigate("/dashboard");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="font-heading text-lg font-semibold">indifferent</div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-[var(--fg-subtle)]">Step 2 of 2 — Verify</div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="eyebrow">Prove you're a person</div>
        <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-semibold mt-2 leading-tight">
          One human, one voice.
        </h1>
        <p className="mt-4 text-[var(--fg-muted)] max-w-md">
          Upload a government-issued photo ID. This keeps bots, burner accounts, and manufactured mobs out.
          Your document is stored securely and never shown to other users.
        </p>

        <div className="mt-8 card p-6">
          <div className="eyebrow mb-3">Upload · JPG, PNG, or PDF · 8 MB max</div>
          <input
            ref={inputRef}
            data-testid="id-file-input"
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-[var(--fg-muted)] file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border file:border-[var(--border-strong)] file:bg-[var(--surface)] file:text-sm file:font-medium hover:file:bg-[var(--bg-muted)] file:cursor-pointer"
          />
          {file && (
            <div className="mt-3 text-sm text-[var(--fg-muted)]">
              Selected: <span className="font-medium text-[var(--fg)]">{file.name}</span> ({Math.round(file.size / 1024)} KB)
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-4 flex-wrap">
          <button data-testid="btn-upload-id" className="btn-accent" disabled={!file || uploading} onClick={upload}>
            {uploading ? "Uploading…" : "Verify identity"}
          </button>
          <div className="text-xs text-[var(--fg-subtle)] max-w-sm">
            MVP note — approval is instant while human review is on the roadmap.
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)] text-xs text-[var(--fg-subtle)]">
          Signed in as {user?.name}
        </div>
      </main>
    </div>
  );
}
