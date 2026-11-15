import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { CONTAINER_NARROW } from "@/lib/layout";

// Set REACT_APP_CONTACT_EMAIL in the frontend's Vercel project to show a
// contact address on these pages.
const CONTACT = process.env.REACT_APP_CONTACT_EMAIL;
const UPDATED = "15 November 2026";

function Page({ title, children }) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)]">
        <div className={`${CONTAINER_NARROW} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between`}>
          <Link to="/"><Logo size="sm" /></Link>
          <ThemeToggle />
        </div>
      </header>
      <main className={`${CONTAINER_NARROW} mx-auto px-4 sm:px-6 py-10`}>
        <div className="eyebrow">Last updated {UPDATED}</div>
        <h1 className="font-heading text-3xl font-semibold mt-2">{title}</h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:underline">
          {children}
          <h2>Contact</h2>
          <p>
            {CONTACT
              ? <>Questions or requests: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</>
              : <>Use the Report option on any profile, debate or claim to reach the moderators.</>}
          </p>
          <p className="text-[var(--fg-subtle)]">
            See also: <Link to="/terms">Terms of Use</Link> · <Link to="/privacy">Privacy Policy</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export function Terms() {
  return (
    <Page title="Terms of Use">
      <p>indifferent is a place to debate people who see things differently. By using it you agree to these terms.</p>

      <h2>Who can use it</h2>
      <ul>
        <li>You must be <strong>18 or older</strong>. Debates can happen on live video with strangers.</li>
        <li>One account per person, with your real identity. Live video debates require ID verification.</li>
      </ul>

      <h2>How to behave</h2>
      <ul>
        <li>Argue with ideas, not people. No harassment, threats, hate speech or slurs.</li>
        <li>No sexual content, nudity, violence or anything illegal, on camera or in text.</li>
        <li>Don't share other people's personal information, and don't record or redistribute debates outside the app without everyone's consent.</li>
        <li>No spam, impersonation, or attempts to break or abuse the service.</li>
      </ul>
      <p>Other debaters can vote to remove someone from a debate, anyone can report content, and moderators may remove content or accounts that break these rules.</p>

      <h2>Recording and publishing</h2>
      <p>
        Video debates are recorded so they can be replayed. Debaters decide together whether a debate is shown publicly.
        Claims you post are public unless you mark them unlisted. You keep ownership of what you create, and give indifferent
        permission to host and show it on the service as you choose.
      </p>

      <h2>AI features</h2>
      <p>
        AI generates debate prompts, maps your stated views, gives coaching hints, plays the opposing side in AI sparring,
        and writes feedback reports. It can be wrong. Don't rely on it for facts, advice or decisions.
      </p>

      <h2>No guarantees</h2>
      <p>
        The service is provided as is, without warranties, and may change or stop. To the extent the law allows, indifferent
        isn't liable for what other users say or do, or for indirect losses. Nothing here limits rights you have under consumer law.
      </p>

      <h2>Ending</h2>
      <p>You can delete your account at any time in Settings. We may suspend accounts that break these terms.</p>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy Policy">
      <p>This explains what indifferent collects, why, and what you can do about it.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your Google sign-in:</strong> name, email address and profile photo.</li>
        <li><strong>Your profile:</strong> display name, handle, bio and any photo you upload.</li>
        <li><strong>Your views:</strong> the topics you pick, your quiz answers and written answer at onboarding, and the stance positions derived from them. These can reveal political or religious opinions; we use them only to match you and run debates.</li>
        <li><strong>ID verification:</strong> the document you upload. It's stored privately and only moderators can view it.</li>
        <li><strong>Debates:</strong> chat messages, votes, reactions, and recordings of your camera and microphone during video debates.</li>
        <li><strong>Claims:</strong> the video clips and captions you post.</li>
        <li><strong>AI sparring:</strong> your sparring transcripts and feedback reports, visible only to you.</li>
        <li><strong>Technical data:</strong> a session token (cookie and browser storage) to keep you signed in, and IP-based rate limiting to prevent abuse.</li>
      </ul>
      <p>Private messages between friends are not processed by AI features.</p>

      <h2>Who processes it for us</h2>
      <ul>
        <li>Google (sign-in), Vercel (hosting and file storage), MongoDB Atlas (database).</li>
        <li>Groq (AI processing of onboarding answers, debate text, sparring and feedback).</li>
        <li>LiveKit (live video).</li>
        <li>Stripe (payments) and Google AdSense (ads), only if those features are switched on.</li>
      </ul>
      <p>We don't sell your data.</p>

      <h2>Why (legal basis)</h2>
      <p>
        To provide the service you signed up for (contract), to keep it safe and prevent abuse (legitimate interests),
        and, for the views you choose to share at onboarding, your explicit consent, which you can withdraw by deleting your account.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li><strong>Delete your account</strong> in Settings. This removes your profile, views, ID document, your own recordings, sparring history and claim videos. Debates you took part in stay for the other participant, with your name removed.</li>
        <li>You can ask for a copy of your data, a correction, or to object to processing, and you can complain to your data protection authority (in the UK, the ICO).</li>
      </ul>
    </Page>
  );
}
