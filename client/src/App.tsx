import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Link2, Share2 } from 'lucide-react';
import Header from './components/Header';
import ShortenForm from './components/ShortenForm';
import ResultCard from './components/ResultCard';
import StatsCard from './components/StatsCard';
import RecentLinks from './components/RecentLinks';
import Footer from './components/Footer';
import { ApiError, createShortUrl, fetchStats } from './services/api';
import type { CreateUrlResponse, RecentLink, UrlStats } from './types';

const MAX_RECENTS = 8;

function upsertRecent(list: RecentLink[], entry: RecentLink): RecentLink[] {
  return [entry, ...list.filter((l) => l.shortCode !== entry.shortCode)].slice(0, MAX_RECENTS);
}

export default function App() {
  const [result, setResult] = useState<CreateUrlResponse | null>(null);
  const [stats, setStats] = useState<UrlStats | null>(null);
  const [recents, setRecents] = useState<RecentLink[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const requestId = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  }

  const loadStats = useCallback(async (code: string, quiet = false) => {
    if (!quiet) setStatsLoading(true);
    try {
      const fresh = await fetchStats(code);
      setStats(fresh);
      setStatsError(null);
      setRecents((list) =>
        list.map((l) =>
          l.shortCode === code ? { ...l, clicks: fresh.clicks, createdAt: fresh.createdAt } : l,
        ),
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setStatsError(err instanceof ApiError ? err.message : 'Could not load statistics.');
    } finally {
      if (!quiet) setStatsLoading(false);
    }
  }, []);

  async function handleShorten(url: string) {
    if (submitting) return; // prevent duplicate submissions
    const id = ++requestId.current;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createShortUrl(url);
      if (id !== requestId.current) return; // a newer request superseded this one
      setResult(created);
      setStats(null);
      setRecents((list) =>
        upsertRecent(list, { ...created, clicks: null, createdAt: null }),
      );
      await loadStats(created.shortCode, true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      if (id === requestId.current) setSubmitting(false);
    }
  }

  function handleNew() {
    requestId.current += 1;
    setResult(null);
    setStats(null);
    setSubmitError(null);
    setStatsError(null);
  }

  async function handleCopyRecent(shortUrl: string) {
    try {
      await navigator.clipboard.writeText(shortUrl);
      showToast(`Copied ${shortUrl}`);
    } catch {
      showToast('Copy failed in this browser.');
    }
  }

  // Refresh stats when the user returns (e.g. after opening the short link).
  useEffect(() => {
    function onVisibility() {
      if (!document.hidden && result) void loadStats(result.shortCode, true);
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [result, loadStats]);

  return (
    <div className="relative min-h-screen bg-[#070b18] font-sans text-slate-200 antialiased">
      {/* ambient background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute top-64 -left-32 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute top-96 -right-32 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative">
        <Header />

        <main className="mx-auto max-w-3xl px-4 pt-12 pb-4 sm:px-6 sm:pt-16">
          <section className="text-center" aria-labelledby="hero-heading">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-indigo-200 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              NestJS · PostgreSQL · React
            </p>
            <h1
              id="hero-heading"
              className="mx-auto mt-5 max-w-xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
            >
              Short links.{' '}
              <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-indigo-300 bg-clip-text text-transparent">
                Clear insights.
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400">
              Paste a long URL, get a short link instantly, and watch the clicks roll in — powered
              by a real API, not demo data.
            </p>
          </section>

          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-6" aria-label="Create a short link">
            <ShortenForm loading={submitting} onShorten={handleShorten} />
          </section>

          {submitError && (
            <div role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {submitError}
            </div>
          )}

          {result && (
            <div className="mt-4 space-y-4">
              <ResultCard result={result} onNew={handleNew} />
              <StatsCard
                stats={stats}
                loading={statsLoading}
                error={statsError}
                onRefresh={() => loadStats(result.shortCode)}
              />
            </div>
          )}

          <RecentLinks links={recents} onCopy={handleCopyRecent} />

          <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="How it works">
            {[
              { icon: Link2, title: 'Shorten', text: 'The API validates your URL and mints a unique 7-character code.' },
              { icon: Share2, title: 'Share', text: 'Copy the short link or open it anywhere — redirects are instant 302s.' },
              { icon: BarChart3, title: 'Measure', text: 'Every visit is counted atomically. Refresh insights any time.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{text}</p>
              </div>
            ))}
          </section>
        </main>

        <Footer />
      </div>

      {toast && (
        <div
          role="status"
          className="animate-rise fixed bottom-6 left-1/2 max-w-[90vw] -translate-x-1/2 truncate rounded-xl border border-white/15 bg-[#121a33] px-4 py-2.5 text-sm font-medium text-white shadow-2xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
