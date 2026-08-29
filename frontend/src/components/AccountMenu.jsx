import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/** Client brief #8 — clicking the avatar opens a dropdown with "Go to your
 * profile" (and sign out). Hand-rolled rather than the shadcn DropdownMenu
 * primitive: that component's default styling is the dormant HSL token set,
 * not the hex CSS-vars every real page actually uses — this stays visually
 * consistent with the rest of the app instead of introducing a second look. */
export default function AccountMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full overflow-hidden border border-[var(--border-strong)] shrink-0"
        data-testid="account-menu-trigger"
      >
        {user?.picture
          ? <img src={user.picture} alt="" className="w-full h-full object-cover" />
          : <span className="w-full h-full flex items-center justify-center bg-[var(--bg-muted)] text-xs font-medium">{(user?.display_name || user?.name || "?")[0]?.toUpperCase()}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 card p-1 shadow-lg z-50" data-testid="account-menu">
          <button
            onClick={() => { setOpen(false); navigate(`/u/${user.user_id}`); }}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-muted)]"
            data-testid="account-menu-profile"
          >
            Go to your profile
          </button>
          <button
            onClick={() => { setOpen(false); navigate("/dashboard"); }}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-muted)]"
          >
            Dashboard
          </button>
          <div className="my-1 border-t border-[var(--border)]" />
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-muted)] text-[var(--danger)]"
            data-testid="account-menu-signout"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
