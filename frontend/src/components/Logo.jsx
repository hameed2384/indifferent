import { useNavigate } from "react-router-dom";

const SIZES = {
  default: { mark: "w-6 h-6", text: "text-xl" },
  sm: { mark: "w-5 h-5", text: "text-lg" },
};

/** The brand mark, in one place. favicon.svg is already a real, deliberately
 * designed logo (rounded square, accent-emerald dot, lowercase "i") — it was
 * only ever wired as the browser-tab icon, never rendered inside the app
 * itself, which instead hand-typed the word "indifferent" independently on
 * every page. Always lowercase, matching the mark's own glyph. */
export default function Logo({ size = "default", onClick, "data-testid": testId = "nav-home", className = "" }) {
  const navigate = useNavigate();
  const { mark, text } = SIZES[size];
  return (
    <button
      onClick={onClick || (() => navigate("/"))}
      className={`inline-flex items-center gap-2 shrink-0 font-heading ${text} font-semibold tracking-tight ${className}`}
      data-testid={testId}
    >
      <img src="/favicon.svg" alt="" className={`${mark} rounded-md`} />
      indifferent
    </button>
  );
}
