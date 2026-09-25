import React from 'react';
import Link from 'next/link';
import { signIn } from '@/lib/auth/auth';

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { error?: string; callbackUrl?: string };
}) {
  const error = searchParams?.error;
  const callbackUrl = searchParams?.callbackUrl || '/dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            V.A.R.N.A.K.
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Visual Architecture & Radiance Navigation with Artificial Knowledge
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            Authentication failed: {error}. Please try again.
          </div>
        )}

        <div className="space-y-4 pt-2">
          <form
            action={async () => {
              'use server';
              await signIn('microsoft-entra-id', { redirectTo: callbackUrl });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 21 21">
                <path fill="#f25022" d="M1 1h9v9H1z" />
                <path fill="#00a4ef" d="M1 11h9v9H1z" />
                <path fill="#7fba00" d="M11 1h9v9H11z" />
                <path fill="#ffb900" d="M11 11h9v9H11z" />
              </svg>
              Sign in with Microsoft Entra External ID
            </button>
          </form>

          <form
            action={async () => {
              'use server';
              await signIn('microsoft-entra-id', { redirectTo: callbackUrl });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
            >
              Create a new Account
            </button>
          </form>
        </div>

        <div className="border-t border-slate-100 pt-4 text-center text-xs text-slate-400 space-y-1">
          <p>Protected by Microsoft Entra External ID enterprise identity.</p>
          <div className="flex justify-center gap-3 text-blue-600 hover:underline">
            <Link href="/privacy">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
