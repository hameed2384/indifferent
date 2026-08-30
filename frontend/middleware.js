"use strict";
// TEMPORARY DIAGNOSTIC — unconditionally marks every response so we can tell
// whether Vercel invokes this file at all in production, independent of the
// bot-detection/matcher logic. Not the real implementation.
module.exports = function middleware(request) {
  return new Response("MIDDLEWARE_DIAGNOSTIC_MARKER", {
    status: 200,
    headers: { "content-type": "text/plain", "x-middleware-diagnostic": "1" },
  });
};
