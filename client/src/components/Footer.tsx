export default function Footer() {
  return (
    <footer className="mt-12 border-t border-white/10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6">
        <p>Briefly — a NestJS + PostgreSQL + React demo.</p>
        <p>Short codes are 7 characters; redirects use HTTP 302.</p>
      </div>
    </footer>
  );
}
