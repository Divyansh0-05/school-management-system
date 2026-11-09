'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl py-24 text-center"><h1 className="text-2xl font-bold">Something went wrong</h1><p className="mt-2 text-slate-600">The page could not be loaded.</p><button onClick={reset} className="mt-6 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">Try again</button></main>;
}
