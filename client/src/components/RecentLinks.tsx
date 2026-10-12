import { Copy, ExternalLink, History } from 'lucide-react';
import type { RecentLink } from '../types';

interface Props {
  links: RecentLink[];
  onCopy: (shortUrl: string) => void;
}

export default function RecentLinks({ links, onCopy }: Props) {
  return (
    <section aria-label="Recent links this session" className="mt-8">
      <h2 className="flex items-center gap-2 text-base font-semibold text-white">
        <History className="h-4 w-4 text-indigo-300" aria-hidden="true" />
        Recent links
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Kept only in this page session — the API has no list endpoint, so this is not a complete
        history.
      </p>
      {links.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
          <p className="text-sm text-slate-400">Nothing here yet.</p>
          <p className="mt-1 text-xs text-slate-500">Links you shorten will appear in this list.</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {links.map((link) => (
            <li
              key={link.shortCode}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={link.shortUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block truncate text-sm font-semibold text-indigo-300 hover:text-indigo-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
                >
                  {link.shortUrl}
                </a>
                <p className="truncate text-xs text-slate-500" title={link.originalUrl}>
                  {link.originalUrl}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 tabular-nums"
                title="Clicks (updates when stats are fetched)"
              >
                {link.clicks === null ? '— clicks' : `${link.clicks} click${link.clicks === 1 ? '' : 's'}`}
              </span>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onCopy(link.shortUrl)}
                  aria-label={`Copy ${link.shortUrl}`}
                  title="Copy"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </button>
                <a
                  href={link.shortUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Open ${link.shortUrl} in a new tab`}
                  title="Open"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
