import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PRODUCTS } from "@/lib/products";

/** The home page: indifferent as a hub of named products, each with its own card. */
export default function Hub({ liveCount = 0 }) {
  return (
    <section className="mb-10" data-testid="hub">
      <div className="mb-6">
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold leading-tight">Hot takes. Pick a side.</h1>
        <p className="mt-2 text-[var(--fg-muted)] max-w-xl">Everything on indifferent, in one place. Free, and most of it needs no sign-up.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRODUCTS.map((p) => (
          <Link
            key={p.key}
            to={p.start || p.path}
            className="card p-5 flex flex-col gap-3 hover:border-[var(--fg-subtle)] transition-colors group"
            data-testid={`hub-${p.key}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.accent }} />
              <span className="font-heading text-lg font-semibold">{p.name}</span>
              {p.badge && <span className="chip-accent !py-0 !px-2 text-[10px]">{p.badge}</span>}
              {p.key === "be" && liveCount > 0 && (
                <span className="ml-auto text-[10px] uppercase tracking-wide font-semibold text-[var(--accent)]">{liveCount} live</span>
              )}
            </div>
            <p className="text-sm text-[var(--fg-muted)] flex-1">{p.pitch}</p>
            <span className="text-sm font-medium inline-flex items-center gap-1.5">
              {p.cta} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
