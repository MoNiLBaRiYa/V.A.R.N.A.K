'use client';

import React from 'react';
import { RankedCandidate } from '@/lib/recommendations/harmony';

interface RecommendationResultsProps {
  recommendations: RankedCandidate[];
  scoringWeightsVersion?: string;
  relaxationApplied?: string[] | null;
  paletteHarmonyApplied?: boolean;
}

export function RecommendationResults({
  recommendations,
  scoringWeightsVersion = 'v1.0.0',
  relaxationApplied,
  paletteHarmonyApplied = false,
}: RecommendationResultsProps) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
        <p className="text-sm text-zinc-500">No paint recommendations generated yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Recommended Paint Palette</h3>
          <p className="text-xs text-zinc-500">
            Top {recommendations.length} climate-optimized and architecturally verified recommendations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
            Model: {scoringWeightsVersion}
          </span>
          {paletteHarmonyApplied && (
            <span className="text-[11px] px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-medium">
              Palette Harmony Active
            </span>
          )}
        </div>
      </div>

      {relaxationApplied && relaxationApplied.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-0.5">Progressive Filter Relaxation Applied:</p>
          <p>
            Relaxed: {relaxationApplied.join(' → ')} to ensure a diverse top-5 candidate selection.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {recommendations.map((rec, idx) => {
          const rank = idx + 1;
          const scorePercent = Math.round(rec.compositeScore * 100);

          return (
            <div
              key={rec.shadeId || idx}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:border-zinc-300 transition-all flex flex-col md:flex-row gap-5"
            >
              {/* Left: Swatch & Rank */}
              <div className="flex flex-row md:flex-col items-center md:items-start gap-4 md:w-44 flex-shrink-0">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-xl shadow-inner border border-black/10"
                    style={{ backgroundColor: rec.hexApprox }}
                  />
                  <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-md">
                    #{rank}
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{rec.shadeName}</h4>
                  <p className="text-xs font-mono text-zinc-500 font-semibold">{rec.shadeCode}</p>
                  <p className="text-[11px] text-zinc-400 capitalize">{rec.colourFamily.toLowerCase().replace(/_/g, ' ')}</p>
                </div>
              </div>

              {/* Middle: Details & Explanation */}
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                    {rec.productName}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    Finish: {rec.finishType}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    Scope: {rec.surfaceScope}
                  </span>
                  {rec.isHarmonyReplacement && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium">
                      Harmony Replacement
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  {(rec as any).explanation || 'Architecturally tuned for environmental radiance and longevity.'}
                </p>

                {/* 9-Factor Mini Breakdown */}
                {rec.factorScores && (
                  <div className="pt-2">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                      9-Factor Scoring Diagnostics
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
                      {Object.entries(rec.factorScores).map(([factorName, f]) => (
                        <div key={factorName} className="flex justify-between items-center text-zinc-500">
                          <span className="truncate max-w-[130px]">{factorName.replace(/_/g, ' ').toLowerCase()}</span>
                          <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">
                            {(f.score * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Score Gauge */}
              <div className="flex md:flex-col items-center justify-between md:justify-center md:w-28 border-t md:border-t-0 md:border-l border-zinc-100 dark:border-zinc-800 pt-3 md:pt-0 md:pl-4">
                <span className="text-xs text-zinc-400 font-medium md:mb-1">Score</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{scorePercent}</span>
                  <span className="text-xs font-semibold text-zinc-400">/100</span>
                </div>
                <span className="text-[10px] text-zinc-400 mt-1">Verified Shade</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
