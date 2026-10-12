import { Activity, BookOpenText, Link2 } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

export default function Header() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <a href="#" className="flex items-center gap-2.5" aria-label="Briefly home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <Link2 className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">Briefly</span>
        </a>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="API links">
          <a
            href={`${API_BASE_URL}/api/docs`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            <BookOpenText className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">API docs</span>
            <span className="sm:hidden">Docs</span>
          </a>
          <a
            href={`${API_BASE_URL}/health`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            <Activity className="h-4 w-4" aria-hidden="true" />
            Health
          </a>
        </nav>
      </div>
    </header>
  );
}
