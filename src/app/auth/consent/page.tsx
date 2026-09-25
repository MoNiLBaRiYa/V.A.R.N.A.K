'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConsentPage() {
  const router = useRouter();
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [aiDisclosureAccepted, setAiDisclosureAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privacyAccepted || !aiDisclosureAccepted) {
      setError('You must accept both the Privacy Policy and AI Disclosure to continue.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacyPolicyVersion: '1.0',
          privacyAccepted: true,
          aiDisclosureAccepted: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || 'Failed to record consent');
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const isFormValid = privacyAccepted && aiDisclosureAccepted;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 space-y-6">
        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 rounded-full">
            Required Consent
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Terms & Privacy Confirmation
          </h1>
          <p className="text-sm text-slate-600">
            Before accessing the V.A.R.N.A.K. workspace, please review and accept our data governance policies and AI processing disclosures.
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="text-sm">
                <span className="font-semibold text-slate-900">Privacy Policy (v1.0)</span>
                <p className="text-slate-500 text-xs mt-0.5">
                  I agree to the collection and processing of property photographs, geographic coordinates, and meteorological profiles solely for generating paint recommendations.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={aiDisclosureAccepted}
                onChange={(e) => setAiDisclosureAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="text-sm">
                <span className="font-semibold text-slate-900">AI Analysis & Recommendation Disclosure</span>
                <p className="text-slate-500 text-xs mt-0.5">
                  I understand that property photos are analyzed using Google Gemini Vision AI to infer architectural styles, daylighting, and wall surfaces. Inferred attributes can be reviewed and manually overridden prior to generating recommendations.
                </p>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={!isFormValid || loading}
            className={`w-full py-3 px-4 rounded-lg text-sm font-semibold text-white transition-all shadow-sm ${
              isFormValid && !loading
                ? 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            {loading ? 'Recording Consent...' : 'Accept & Proceed to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
