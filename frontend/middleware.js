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

async function middleware(request) {
  try {
    const ua = request.headers.get("user-agent") || "";
    if (!CRAWLER_UA.test(ua)) return next();

    const { pathname } = new URL(request.url);
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
