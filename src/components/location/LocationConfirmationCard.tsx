'use client';

import React, { useState } from 'react';

interface LocationConfirmationCardProps {
  projectId: string;
  existingLocation?: {
    rawInput: string;
    resolvedAddress?: string | null;
    latitude: number;
    longitude: number;
  } | null;
  onConfirmed: (location: any) => void;
}

export function LocationConfirmationCard({
  projectId,
  existingLocation,
  onConfirmed,
}: LocationConfirmationCardProps) {
  const [input, setInput] = useState(existingLocation?.rawInput || '');
  const [resolved, setResolved] = useState<{
    rawInput: string;
    resolvedAddress: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setResolving(true);
    setError(null);
    setResolved(null);

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: input.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Could not resolve location');
      }

      setResolved(data.resolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search location');
    } finally {
      setResolving(false);
    }
  };

  const handleConfirm = async () => {
    if (!resolved) return;
    setConfirming(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/location/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resolved),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to confirm location');
      }

      onConfirmed(data.location);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Property Location & Climate Setting</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter an address or 6-digit PIN code to determine local microclimate and weather exposure.
          </p>
        </div>
        {existingLocation && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
            Confirmed Location
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleResolve} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. 560038 or Indiranagar, Bengaluru"
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <button
          type="submit"
          disabled={resolving || !input.trim()}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {resolving ? 'Searching...' : 'Search'}
        </button>
      </form>

      {resolved && (
        <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-200 space-y-3 animate-in fade-in">
          <div className="space-y-1">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
              Resolved Geographic Match
            </span>
            <p className="text-sm font-semibold text-slate-900">{resolved.resolvedAddress}</p>
            <p className="text-xs text-slate-500 font-mono">
              Coordinates: {resolved.latitude.toFixed(5)}°N, {resolved.longitude.toFixed(5)}°E
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {confirming ? 'Saving & Fetching Climate...' : 'Confirm This Location'}
            </button>
            <button
              type="button"
              onClick={() => setResolved(null)}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Change
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
