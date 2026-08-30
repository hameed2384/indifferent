/** A filled/unfilled 2-segment progress indicator for the mandatory
 * onboarding -> verify flow — a symbol instead of a sentence for something
 * there are only ever two of. */
export default function StepDots({ step, total = 2 }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`w-6 h-1 rounded-full ${i < step ? "bg-[var(--fg)]" : "bg-[var(--border-strong)]"}`} />
      ))}
    </div>
  );
}
