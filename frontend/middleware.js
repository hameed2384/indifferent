"use strict";
// CommonJS on purpose (require/module.exports, not import/export): the
// project has no "type": "module" in package.json, and craco.config.js /
// postcss.config.js / tailwind.config.js at this same root all rely on
// staying CommonJS — this file matches them rather than forcing a
// project-wide module-type change for one feature.
const { next } = require("@vercel/functions");

// This is a static SPA (CRA) — every route serves the same index.html with
// one fixed, site-wide og:title/og:description/og:image (see public/
// index.html). That's fine for a human clicking a link (React renders the
// real page after load), but a link-preview crawler (Facebook, Twitter/X,
// Slack, Discord, iMessage, ...) never runs the app's JS — it only reads
// whatever <head> tags come back on the very first response. Without this,
// every shared /watch/:id or /u/:id link previews identically, which is a
// real loss for a platform whose growth loop is "share a specific debate."
//
// This intercepts ONLY requests whose User-Agent matches a known crawler
// (config.matcher below also restricts it to exactly these two dynamic
// routes), fetches the real debate/profile data from the public API, and
// returns a minimal HTML document with per-route meta tags. Everything
// else — including every real visitor — falls through to next() untouched.
// Any failure anywhere in here (backend down, unexpected shape, timeout)
// also falls through to next(): a slightly-wrong link preview is an
// acceptable failure mode, breaking the actual site is not.

const BACKEND = "https://backend-kappa-lac-93.vercel.app";
const SITE = "https://indifferent.hameed.pro";
const OG_IMAGE = `${SITE}/og-image.png`;
const DEFAULT_TITLE = "indifferent — live video debate";
const DEFAULT_DESCRIPTION = "Find someone who disagrees with you. On camera. Live.";

const CRAWLER_UA = /facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|LinkedInBot|WhatsApp|TelegramBot|SkypeUriPreview|Applebot|redditbot|Google-InspectionTool/i;

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderHtml({ title, description }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="indifferent"/>
<meta property="og:title" content="${safeTitle}"/>
<meta property="og:description" content="${safeDescription}"/>
<meta property="og:image" content="${OG_IMAGE}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${safeTitle}"/>
<meta name="twitter:description" content="${safeDescription}"/>
<meta name="twitter:image" content="${OG_IMAGE}"/>
</head><body></body></html>`;
}

async function fetchJson(url) {
  // The backend is a Python serverless function on a cold-start-prone
  // platform; 3s wasn't enough margin and every crawler request was timing
  // out (confirmed live — TimeoutError, not a data/shape problem). This
  // only runs for crawler requests, so a slower link-preview response is an
  // acceptable tradeoff for actually getting the real content most of the
  // time; crawlers themselves typically tolerate several seconds too.
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return res.json();
}

function xmlEscape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

function urlEntry(loc, lastmod) {
  return `<url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${xmlEscape(lastmod.slice(0, 10))}</lastmod>` : ""}</url>`;
}

async function buildSitemap() {
  // Best-effort: static routes always go in; the two dynamic lists degrade
  // independently (one backend hiccup shouldn't drop the other, and a
  // sitemap missing some entries is a much smaller problem than a sitemap
  // that 500s and gets Search Console to stop trusting it).
  const staticUrls = [urlEntry(`${SITE}/`), urlEntry(`${SITE}/watch`), urlEntry(`${SITE}/claims`)];

  const debates = await fetchJson(`${BACKEND}/api/public/debates`).catch(() => null);
  const debateUrls = (debates?.debates || []).map((d) => urlEntry(`${SITE}/watch/${d.room_id}`, d.published_at));

  const claims = await fetchJson(`${BACKEND}/api/clips/roots`).catch(() => null);
  const claimUrls = (claims?.claims || []).map((c) => urlEntry(`${SITE}/claims/${c.clip_id}`, c.created_at));

  const body = [...staticUrls, ...debateUrls, ...claimUrls].join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

async function middleware(request) {
  try {
    const { pathname } = new URL(request.url);

    if (pathname === "/sitemap.xml") {
      const xml = await buildSitemap();
      return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8" } });
    }

    const ua = request.headers.get("user-agent") || "";
    if (!CRAWLER_UA.test(ua)) return next();

    const [, section, id] = pathname.split("/");
    if (!id) return next();

    let title = DEFAULT_TITLE;
    let description = DEFAULT_DESCRIPTION;

    if (section === "watch") {
      const d = await fetchJson(`${BACKEND}/api/public/debates/${encodeURIComponent(id)}`);
      if (d) {
        const a = d.side_a?.display_name || "Someone";
        const b = d.side_b?.open ? "an open seat" : (d.side_b?.display_name || "someone");
        title = d.topics?.[0] ? `"${d.topics[0]}" — indifferent` : DEFAULT_TITLE;
        description = `${a} vs ${b} — watch the debate${d.status === "active" ? " live" : ""} on indifferent.`;
      }
    } else if (section === "u") {
      const p = await fetchJson(`${BACKEND}/api/users/${encodeURIComponent(id)}`);
      if (p) {
        title = `${p.display_name || "Someone"} on indifferent`;
        description = p.bio?.trim() || `${p.debates_count ?? 0} debates, ${p.followers_count ?? 0} followers — see their positions on indifferent.`;
      }
    } else {
      return next();
    }

    return new Response(renderHtml({ title, description }), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch {
    return next();
  }
}

module.exports = middleware;
