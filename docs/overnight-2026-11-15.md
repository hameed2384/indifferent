# Overnight changes — 15 November 2026

Everything below is live on indifferent.hameed.pro (pushed to `main`, each deploy and CI run checked). Each change was its own commit, so any one of them can be reverted on its own with `git revert <commit>`.

## The big one: AI sparring partner

**Problem:** with few people online, almost every visitor who tried to debate sat on "Finding your opposite" forever, then left.

**Now:** anyone who's done onboarding can debate an AI that argues the **opposite of their own stance** on one of their topics. Ending the round gives a **report**: scores for clarity, evidence, rebuttal and civility, strengths, what to improve, logical slips, and their best line.

- **No ID verification needed** (no other person is involved), so new users get their first debate minutes after signing up.
- **Ways in:**
  - "Spar with AI" on the home banner
  - an offer on the Match screen after 12 seconds without a human match
  - "Start with AI sparring" on the Verify page
  - "AI sparring" in the account menu
- **Progress page** `/spar`: past rounds, average score and recent trend. It counts toward daily streaks.
- **Free:** runs on your existing Groq key. If Groq is down it falls back to built-in replies rather than breaking.
- **Isolated:** stored in its own collections (`ai_debates`, `ai_debate_messages`), so it can't touch human debates, the public feed or recordings.
- **Limits:** 12 turns per round, plus rate limits.

**Commits:** `49cd478`, `eb60d8b`

## Shareable results (growth loop)

- After a scored round, **"Share my result"** creates a public link like `/s/abc123`. It uses the phone's share sheet, or copies the link on desktop.
- The **public card** shows the score, the breakdown, the summary and the person's best line, never the transcript, plus a **"Try it free"** button.
- **Link previews** on WhatsApp, X and Discord read something like "Ayo scored 7.8/10 — indifferent".

**Commit:** `66a7a4b`

## Business model

- **Ads off** and **paid tiers hidden** (the £9 membership and £2 debater subscriptions). The code is intact behind switches:
  - frontend: `REACT_APP_ENABLE_ADS`, `REACT_APP_ENABLE_PAYMENTS`
  - backend: `PAYMENTS_ENABLED`

  Set them to `true` in Vercel to turn things back on.
- **Joining a live debate as a third voice is free** while payments are off. It now always requires ID verification instead, because joiners go on camera.
- **Why:** ads earn almost nothing at your traffic and make a new product feel cheap. Paid tiers have nothing to sell before there's an audience, and taking money moves you off Vercel's free (non-commercial) plan.
- **Suggested path:** the sparring **report is the future paid feature**. Keep it free now; later offer deeper reports and progress tracking for around £3–5/month. Schools and debate clubs are the bigger opportunity once it's proven.

**Commit:** `49cd478`

## Trust & safety (this was a real legal gap)

- **Terms** (`/terms`) and **Privacy Policy** (`/privacy`), written against what the code actually stores and which services process it.
- **18+ and terms checkbox at onboarding**, enforced by the backend.
- **Debates are recorded, and people weren't told.** There's now a red "Recording" badge in debate rooms and a heads-up on the Match screen.
- **"Delete my account" in Settings.** Account deletion, by the user or by an admin, now also removes the person's **ID document, their own recordings, sparring history and claim videos**. Before, the ID document and recordings stayed in storage after an account was deleted.
- **Footer links** to Terms and Privacy.

**Commit:** `b8e94a1`

## Matching

- **Only people who actually disagree get matched** now: a gap of at least 3 points on a shared topic (`MIN_OPPOSITION` in `backend/app/routers/match.py`). Before, two people with the same view could be paired. Anyone without an opposed match gets the sparring offer.

**Commit:** `bd00932`

## Cost

- **Polling pauses in background tabs** and refreshes when you come back.
- **The home feed refreshes every 20s** instead of every 8s.

**Commit:** `386817a`

## Earlier in the session (also live)

- Test suites and CI: 58 backend and 13 frontend tests, run on every push.
- Logout fix for Safari/iPhone.
- Faster cold starts: 8s down to about 0.4s.
- Admin "Remove" for claims.

## Things only you can do

1. **Delete the 4 test claims:** sign in, open each one from Claims, click Remove.
2. **Optional:** set `REACT_APP_CONTACT_EMAIL` in the frontend's Vercel project, so the Terms and Privacy pages show a contact address. I didn't publish your email without asking.
3. **Optional:** apply the new database indexes for sparring. It works without them; they just keep it fast as it grows. Run this once from `backend/`:
   `MONGO_URL="<production>" DB_NAME="<production db>" uv run --frozen python -m scripts.setup_db`
4. **Try a sparring round yourself on the live site.** Locally it was tested with the fallback replies only (no Groq key on this PC), so the real AI replies and reports haven't been seen yet.

## Not done / worth knowing

- **AdSense script still in the page:** `public/index.html` still loads the AdSense script, which you'd said was for site verification. If Auto ads is switched on in your AdSense dashboard, ads could still appear; switch Auto ads off there to be sure.
- **Existing users are fine:** people who onboarded before tonight aren't asked to tick the new 18+ box. It only applies to new sign-ups and to anyone redoing onboarding.
