import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
          Runtime preview
        </p>
        <h1 className="text-3xl font-semibold text-stone-900">
          EV-First Training Sandbox
        </h1>
        <p className="text-base text-stone-700">
          Use the manual preview to exercise the training API routes end to end.
          Seed and session inputs keep runs deterministic.
        </p>
      </header>
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">Quick start</h2>
        <p className="mt-2 text-sm text-stone-700">
          Open the manual preview and drive spot quiz, hand play, targeted drill,
          and review flows.
        </p>
        <Link
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          href="/train"
        >
          Open Training Preview
        </Link>
      </section>
    </main>
  );
}
