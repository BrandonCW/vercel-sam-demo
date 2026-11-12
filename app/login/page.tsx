'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowRight, Lock } from 'lucide-react';
import { DealDeskLogoMark } from '@/components/ui/deal-desk-logo';
import { sanitizeRedirectPath } from '@/lib/auth';

function RedirectParamReader({ onResolve }: { onResolve: (path: string) => void }) {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect');

  useEffect(() => {
    onResolve(sanitizeRedirectPath(rawRedirect));
  }, [rawRedirect, onResolve]);

  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [redirectPath, setRedirectPath] = useState<string>('/');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleResolveRedirect = useCallback((sanitized: string) => {
    setRedirectPath(sanitized);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // Non-JSON error response
      }

      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        setIsLoading(false);
        return;
      }

      const safeDestination = sanitizeRedirectPath(redirectPath);
      router.push(safeDestination);
      router.refresh();
    } catch {
      setError('Unable to reach authentication service. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F8F6] text-[#111215] font-sans flex flex-col justify-center items-center px-4 py-12">
      <Suspense fallback={null}>
        <RedirectParamReader onResolve={handleResolveRedirect} />
      </Suspense>

      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E2E0D8] rounded-lg p-8">
        <div className="flex items-center gap-3 pb-6 mb-6 border-b border-[#E2E0D8]">
          <DealDeskLogoMark className="size-9 shrink-0" />
          <div>
            <p className="font-sans text-kicker font-semibold uppercase text-[#636772]">
              DEAL OPERATIONS
            </p>
            <h1 className="font-sans text-base font-bold tracking-[-0.025em] text-[#111215] leading-tight">
              Qualification System
            </h1>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="font-sans text-base font-semibold tracking-[-0.015em] text-[#111215] mb-1.5">
            Sign in to Deal Desk Workbench
          </h2>
          <p className="font-sans text-sm text-[#52545D] leading-relaxed text-pretty">
            Enter your workspace access password to review active opportunities, run MEDDPICC deal
            audits, and synchronize qualification updates.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-md bg-[#F1F0EC] border border-[#111215] flex items-start gap-2.5 font-sans text-sm text-[#111215]"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#111215]" aria-hidden="true" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="password"
              className="block font-sans text-kicker font-semibold text-[#52545D] mb-1.5 uppercase"
            >
              Access Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#636772]">
                <Lock className="w-4 h-4" aria-hidden="true" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter workspace password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-10 pl-9 pr-3 py-2.5 bg-[#F1F0EC] border border-[#E2E0D8] rounded-md font-sans text-sm text-[#111215] placeholder-[#636772] focus:outline-none focus:border-[#111215] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full min-h-10 py-2.5 px-4 bg-[#0F52BA] hover:bg-[#0C4196] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-[#FFFFFF] font-sans text-sm font-semibold rounded-md inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {isLoading ? (
              <span
                aria-label="Signing in"
                className="inline-block w-4 h-4 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin"
              />
            ) : (
              <>
                <span className="ui-pill-label">Enter Workbench</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
