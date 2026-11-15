import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import ConfirmModal from "@/components/ConfirmModal";
import { RowSkeletonList } from "@/components/SkeletonCard";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Admin > Marketing: prepared Instagram posts. Nothing is posted until an
 * admin clicks Publish and confirms. */
export default function InstagramPublisher() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [captions, setCaptions] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setFailed(false);
    api.get("/admin/instagram")
      .then(({ data }) => {
        setData(data);
        setCaptions((prev) => Object.fromEntries(data.posts.map((p) => [p.id, prev[p.id] ?? p.caption])));
      })
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  const setPost = (id, patch) =>
    setData((d) => ({ ...d, posts: d.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const publish = async (post) => {
    setConfirm(null);
    setBusyId(post.id);
    try {
      await api.post(`/admin/instagram/posts/${post.id}/prepare`, { caption: captions[post.id] });
      setPost(post.id, { status: "processing", error: null });
      // Instagram processes the images before the post can go live.
      for (let i = 0; i < 30; i++) {
        await sleep(3000);
        const { data: r } = await api.post(`/admin/instagram/posts/${post.id}/publish`);
        if (r.status === "published") {
          setPost(post.id, r);
          toast.success("Posted to Instagram");
          return;
        }
      }
      toast.error("Instagram is still processing. Check back in a minute.");
    } catch (e) {
      const detail = e.response?.data?.detail || "Couldn't publish. Try again.";
      setPost(post.id, { status: "failed", error: detail });
      toast.error(detail);
    } finally {
      setBusyId(null);
    }
  };

  if (failed) return <p className="text-sm text-[var(--danger)]">Couldn't load Instagram posts. Try again.</p>;
  if (!data) return <RowSkeletonList />;

  return (
    <div className="space-y-5">
      {!data.configured ? (
        <p className="text-sm text-[var(--fg-muted)]">
          Instagram isn't connected. Add <code>INSTAGRAM_ACCESS_TOKEN</code> and <code>INSTAGRAM_USER_ID</code> to the backend in Vercel, then redeploy.
        </p>
      ) : data.account ? (
        <p className="text-sm text-[var(--fg-muted)]">
          Connected as <strong className="text-[var(--fg)]">@{data.account.username}</strong>. Nothing is posted until you click Publish.
        </p>
      ) : (
        <p className="text-sm text-[var(--danger)]">Instagram rejected the saved token: {data.account_error}</p>
      )}

      <div className="divide-y divide-[var(--border)]">
        {data.posts.map((p) => {
          const published = p.status === "published";
          const busy = busyId === p.id;
          return (
            <div key={p.id} className="py-4 grid md:grid-cols-[minmax(0,320px)_1fr] gap-4" data-testid={`ig-post-${p.id}`}>
              <div className="flex gap-2 overflow-x-auto">
                {p.images.map((src) => (
                  <img key={src} src={src} alt="" loading="lazy"
                    className="w-24 aspect-[4/5] object-cover rounded-md border border-[var(--border)] shrink-0" />
                ))}
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-sm">{p.title}{p.images.length > 1 && <span className="text-[var(--fg-subtle)]"> · {p.images.length} slides</span>}</div>
                  {published && <span className="chip-accent !py-0 !px-2 text-[11px]">Published</span>}
                  {p.status === "failed" && <span className="chip !py-0 !px-2 text-[11px] !text-[var(--danger)] !border-[var(--danger)]">Failed</span>}
                </div>
                <textarea
                  className="textarea !min-h-[7rem] text-sm"
                  value={captions[p.id] ?? ""}
                  onChange={(e) => setCaptions((c) => ({ ...c, [p.id]: e.target.value }))}
                  disabled={published || busy}
                  maxLength={2200}
                  aria-label={`Caption for ${p.title}`}
                />
                {p.error && !published && <p className="text-xs text-[var(--danger)]">{p.error}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {published ? (
                    p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="btn-outline text-sm">View on Instagram</a>
                  ) : (
                    <button
                      onClick={() => setConfirm(p)}
                      disabled={!data.account || busy || busyId !== null || !(captions[p.id] || "").trim()}
                      className="btn-accent text-sm"
                      data-testid={`btn-ig-publish-${p.id}`}
                    >
                      {busy ? "Publishing…" : "Publish"}
                    </button>
                  )}
                  {published && p.published_at && (
                    <span className="text-xs text-[var(--fg-subtle)]">Posted {new Date(p.published_at).toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {confirm && (
        <ConfirmModal
          title="Post to Instagram?"
          body={`"${confirm.title}" will be posted publicly on @${data.account?.username}. You can delete it from Instagram afterwards, but people may see it first.`}
          confirmLabel="Publish now"
          danger={false}
          onConfirm={() => publish(confirm)}
          onClose={() => setConfirm(null)}
          testIdPrefix="ig-confirm"
        />
      )}
    </div>
  );
}
