import { useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Scissors } from 'lucide-react';
import { isHttpUrl } from '../services/api';

interface Props {
  loading: boolean;
  onShorten: (url: string) => void;
}

export default function ShortenForm({ loading, onShorten }: Props) {
  const [value, setValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setLocalError('Enter a URL to shorten.');
      return;
    }
    if (!isHttpUrl(trimmed)) {
      setLocalError('Enter a valid URL starting with http:// or https://.');
      return;
    }
    setLocalError(null);
    onShorten(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Shorten a URL">
      <label htmlFor="url-input" className="mb-2 block text-sm font-medium text-slate-300">
        Paste a long URL
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="url-input"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://example.com/very/long/link"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          aria-invalid={localError ? true : undefined}
          aria-describedby={localError ? 'url-error' : undefined}
          className="h-13 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3.5 text-[15px] font-semibold whitespace-nowrap text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Shortening…
            </>
          ) : (
            <>
              <Scissors className="h-5 w-5" aria-hidden="true" />
              Shorten URL
            </>
          )}
        </button>
      </div>
      {localError && (
        <p id="url-error" role="alert" className="mt-2 text-sm text-rose-300">
          {localError}
        </p>
      )}
    </form>
  );
}
