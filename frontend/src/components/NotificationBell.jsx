import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function messageFor(n) {
  const name = n.actor_name || "Someone";
  switch (n.type) {
    case "friend_request": return `${name} sent you a friend request`;
    case "friend_accept": return `${name} accepted your friend request`;
    case "new_follower": return `${name} followed you`;
    case "clip_reply": return `${name} replied to your claim`;
    case "join_request_decided": return n.payload?.approved ? `You were let into ${name}'s debate` : `Your request to join ${name}'s debate was declined`;
    case "debater_live": return `${name} just went live`;
    default: return `${name} did something`;
  }
}

function destinationFor(n) {
  switch (n.type) {
    case "friend_request": return "/friends";
    case "friend_accept": return n.actor_id ? `/u/${n.actor_id}` : "/friends";
    case "new_follower": return n.actor_id ? `/u/${n.actor_id}` : null;
    case "clip_reply": return n.payload?.clip_id ? `/claims/${n.payload.clip_id}` : null;
    case "join_request_decided": return n.payload?.room_id ? `/watch/${n.payload.room_id}` : null;
    case "debater_live": return n.payload?.room_id ? `/watch/${n.payload.room_id}` : null;
    default: return null;
  }
}

/** In-app notification center — the pull-back loop the app otherwise has
 * none of (no email, no push). Polls the same way SideNav's friend-request
 * badge already does; opening the panel marks everything read (no
 * per-item read state yet — the simplest version of "I've seen this"). */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = () => {
    api.get("/notifications").then(({ data }) => {
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      api.post("/notifications/read-all").catch(() => {});
    }
  };

  const onItemClick = (n) => {
    setOpen(false);
    const to = destinationFor(n);
    if (to) navigate(to);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="btn-ghost !px-2.5 relative"
        title="Notifications"
        aria-label="Notifications"
        data-testid="notification-bell"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent)] text-[var(--bg)] text-[10px] font-semibold flex items-center justify-center leading-none" data-testid="notification-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] card p-1 shadow-lg z-50 max-h-96 overflow-y-auto" data-testid="notification-panel">
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-[var(--fg-subtle)]">No notifications yet</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.notification_id}
                onClick={() => onItemClick(n)}
                className={`w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-[var(--bg-muted)] ${!n.read ? "bg-[var(--accent-soft)]" : ""}`}
                data-testid={`notification-item-${n.notification_id}`}
              >
                <div>{messageFor(n)}</div>
                <div className="text-xs text-[var(--fg-subtle)] mt-0.5">{timeAgo(n.created_at)}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
