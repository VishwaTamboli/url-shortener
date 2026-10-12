import { useState } from 'react';
import { Check, Copy, ExternalLink, Link2, RotateCcw } from 'lucide-react';
import type { CreateUrlResponse } from '../types';

interface Props {
  result: CreateUrlResponse;
  onNew: () => void;
}

export default function ResultCard({ result, onNew }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.shortUrl);
    } catch {
      // Fallback for contexts where the Clipboard API is unavailable.
      const area = document.createElement('textarea');
      area.value = result.shortUrl;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section
      aria-live="polite"
      aria-label="Shortened URL result"
      className="animate-rise rounded-2xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/10 to-transparent p-5 shadow-xl shadow-black/30 sm:p-6"
    >
      <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-emerald-300">
        <Check className="h-4 w-4" aria-hidden="true" />
        Your short link is ready
      </p>
      <a
        href={result.shortUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-1 block truncate text-xl font-bold text-white underline decoration-indigo-400/60 decoration-2 underline-offset-4 hover:decoration-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300 sm:text-2xl"
      >
        {result.shortUrl}
      </a>
      <p className="mt-2 flex items-start gap-1.5 truncate text-sm text-slate-400">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate" title={result.originalUrl}>
          {result.originalUrl}
        </span>
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={handleCopy}
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 active:scale-[0.98]"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy
            </>
          )}
        </button>
        <a
          href={result.shortUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open link
        </a>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Shorten another
        </button>
      </div>
    </section>
  );
}
