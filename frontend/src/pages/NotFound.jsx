import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center px-4 text-center">
      <Logo />
      <div className="eyebrow mt-8">404</div>
      <h1 className="font-heading text-3xl sm:text-4xl font-semibold mt-2">This page doesn't exist.</h1>
      <p className="mt-3 text-[var(--fg-muted)] max-w-sm">The link might be broken, or the debate/claim behind it may have been removed.</p>
      <button onClick={() => navigate("/")} className="btn-accent mt-6" data-testid="btn-404-home">Back to indifferent</button>
    </div>
  );
}
