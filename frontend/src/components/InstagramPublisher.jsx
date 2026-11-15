import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import ConfirmModal from "@/components/ConfirmModal";
import { RowSkeletonList } from "@/components/SkeletonCard";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slidesOf = (post) => (post.video ? [{ type: "video", src: post.video, poster: post.images?.[0] }] : post.images.map((src) => ({ type: "image", src })));

function Slide({ slide, className, controls = false }) {
  return slide.type === "video"
    ? <video src={slide.src} poster={slide.poster} className={className} controls={controls} muted={!controls} playsInline preload="metadata" />
    : <img src={slide.src} alt="" className={className} />;
}

function Arrow({ dir, onClick, className = "" }) {
  return (
    <button type="button" onClick={onClick} aria-label={dir < 0 ? "Previous slide" : "Next slide"}
      className={`w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 ${className}`}>
      {dir < 0 ? "‹" : "›"}
    </button>
  );
}

/** The post as it will look: one slide at a time, arrows for carousels,
 * click to open full size. */
function PostPreview({ post, onOpen }) {
  const slides = slidesOf(post);
  const [i, setI] = useState(0);
  const go = (d) => setI((n) => (n + d + slides.length) % slides.length);
  return (
    <div className="self-start w-full max-w-[260px]">
      <div className="relative">
        <button type="button" onClick={() => onOpen(i)} className="block w-full" aria-label={`Open ${post.title} full size`}>
          <Slide slide={slides[i]} className="w-full aspect-[4/5] object-cover rounded-lg border border-[var(--border)] bg-black" />
        </button>
        {slides.length > 1 && (
          <>
            <Arrow dir={-1} onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2" />
            <Arrow dir={1} onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2" />
          </>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--fg-subtle)]">
        <span>{post.video ? "Reel" : slides.length > 1 ? `Slide ${i + 1} of ${slides.length}` : "Single image"}</span>
        {slides.length > 1 && (
          <span className="flex gap-1">
            {slides.map((_, n) => (
              <button key={n} type="button" onClick={() => setI(n)} aria-label={`Slide ${n + 1}`}
                className={`w-1.5 h-1.5 rounded-full ${n === i ? "bg-[var(--fg)]" : "bg-[var(--border-strong)]"}`} />
            ))}
          </span>
        )}
        <button type="button" onClick={() => onOpen(i)} className="hover:text-[var(--fg)]">View full size</button>
      </div>
    </div>
  );
}

/** Full-screen viewer: arrow keys or buttons to move, Esc to close. */
function SlideViewer({ post, start, onClose }) {
  const slides = slidesOf(post);
  const [i, setI] = useState(start);
  const go = (d) => setI((n) => (n + d + slides.length) % slides.length);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={post.title} onClick={onClose}>
      <div className="flex items-center gap-3 sm:gap-6 max-w-full" onClick={(e) => e.stopPropagation()}>
        {slides.length > 1 && <Arrow dir={-1} onClick={() => go(-1)} className="shrink-0" />}
        <Slide slide={slides[i]} controls className="max-h-[80vh] max-w-[80vw] w-auto rounded-lg" />
        {slides.length > 1 && <Arrow dir={1} onClick={() => go(1)} className="shrink-0" />}
      </div>
      <div className="mt-4 text-sm text-white/80 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="font-medium text-white">{post.title}</div>
        {slides.length > 1 && <div>Slide {i + 1} of {slides.length} · use ← → keys</div>}
      </div>
      <button type="button" onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white text-sm px-3 py-1.5 rounded-md bg-white/10">Close (Esc)</button>
    </div>
  );
}

/** Admin > Marketing: prepared Instagram posts. Nothing is posted until an
 * admin clicks Publish and confirms. */
export default function InstagramPublisher() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [captions, setCaptions] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [viewer, setViewer] = useState(null);

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
      // Videos take longer for Instagram to process than images.
      for (let i = 0; i < (post.video ? 80 : 30); i++) {
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
          {data.token?.kind === "instagram" && (
            <span className="block text-xs text-[var(--fg-subtle)] mt-1">
              {data.token.expires_at
                ? `Access renews automatically each week; current access is valid until ${new Date(data.token.expires_at).toLocaleDateString()}.`
                : "Access renews automatically each week, starting a day after the token was created."}
            </span>
          )}
        </p>
      ) : (
        <p className="text-sm text-[var(--danger)]">Instagram rejected the saved token: {data.account_error}</p>
      )}

      <div className="divide-y divide-[var(--border)]">
        {data.posts.map((p) => {
          const published = p.status === "published";
          const busy = busyId === p.id;
          return (
            <div key={p.id} className="py-5 grid md:grid-cols-[260px_1fr] gap-5" data-testid={`ig-post-${p.id}`}>
              <PostPreview post={p} onOpen={(i) => setViewer({ post: p, index: i })} />
              <div className="min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-sm">{p.title}{p.images.length > 1 && <span className="text-[var(--fg-subtle)]"> · {p.images.length} slides</span>}</div>
                  {published && <span className="chip-accent !py-0 !px-2 text-[11px]">Published</span>}
                  {p.status === "failed" && <span className="chip !py-0 !px-2 text-[11px] !text-[var(--danger)] !border-[var(--danger)]">Failed</span>}
                </div>
                <textarea
                  className="textarea !min-h-[14rem] text-sm"
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

      {viewer && <SlideViewer post={viewer.post} start={viewer.index} onClose={() => setViewer(null)} />}

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
