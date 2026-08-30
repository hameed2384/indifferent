import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

/** Standardizes the "← <destination>" back-navigation button — previously
 * a literal "←" character hand-typed independently on 7+ pages with 7+
 * different destination words — into one real ChevronLeft icon + label. */
export default function BackButton({ to, label, useHistory = false, "data-testid": testId, className = "" }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (useHistory ? navigate(-1) : navigate(to))}
      className={`btn-ghost text-sm shrink-0 ${className}`}
      data-testid={testId}
    >
      <ChevronLeft className="w-4 h-4" /> {label}
    </button>
  );
}
