export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
          Runtime preview
        </p>
        <h1 className="text-3xl font-semibold text-stone-900">
          EV-First Training Sandbox
        </h1>
        <p className="text-base text-stone-700">
          This placeholder will host the manual preview UI in Task D. Keep the
          session deterministic by providing explicit seed and session inputs in
          upcoming flows.
        </p>
      </header>
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">
          What&apos;s next
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-stone-700">
          <li>Runtime wiring module (Task B)</li>
          <li>Thin API routes (Task C)</li>
          <li>Manual preview UI (Task D)</li>
        </ul>
      </section>
    </main>
  );
}
