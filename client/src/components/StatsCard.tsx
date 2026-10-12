import { CalendarDays, Loader2, MousePointerClick, RefreshCw } from 'lucide-react';
import type { UrlStats } from '../types';

interface Props {
  stats: UrlStats | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export default function StatsCard({ stats, loading, error, onRefresh }: Props) {
  return (
    <section
      aria-live="polite"
      aria-label="Link statistics"
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/30 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Insights</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || !stats}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {loading && !stats ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading statistics…
        </p>
      ) : error && !stats ? (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      ) : stats ? (
        <>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#0b1226] p-4">
              <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400 uppercase">
                <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />
                Clicks
              </dt>
              <dd className="mt-1 text-3xl font-bold text-white tabular-nums">{stats.clicks}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0b1226] p-4">
              <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400 uppercase">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Created
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-200">{formatDate(stats.createdAt)}</dd>
              <dd className="mt-1 truncate font-mono text-xs text-slate-500" title={stats.shortCode}>
                /{stats.shortCode}
              </dd>
            </div>
          </dl>
          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-300">
              Refresh failed: {error}
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Clicks update each time someone opens the short URL. Open the link above, come back
            here, and hit refresh to see the count go up.
          </p>
        </>
      ) : null}
    </section>
  );
}
