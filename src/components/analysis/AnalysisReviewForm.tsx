'use client';

import React, { useState } from 'react';
import { AnalysisState, ApplicationScope } from '@/types/enums';

interface AnalysisReviewFormProps {
  projectId: string;
  imageId: string;
  initialData: {
    spaceType?: string | null;
    isInterior?: boolean | null;
    facadeType?: string | null;
    floorCount?: number | null;
    architecturalStyle?: string | null;
    visibleSurfaces?: string | null; // JSON string
    naturalLightQuality?: string | null;
    paintableRegions?: string | null; // JSON string
    analysisState?: string;
  };
  projectScope?: ApplicationScope;
  onReviewSaved?: (updated: any) => void;
}

const SPACE_TYPES = [
  'LIVING_ROOM',
  'BEDROOM',
  'KITCHEN',
  'BATHROOM',
  'DINING',
  'EXTERIOR_FACADE',
  'BALCONY',
  'HALLWAY',
  'OFFICE',
  'OTHER',
];

const ARCHITECTURAL_STYLES = [
  'MODERN',
  'CONTEMPORARY',
  'TRADITIONAL',
  'COLONIAL',
  'MINIMALIST',
  'INDUSTRIAL',
  'OTHER',
];

const LIGHT_QUALITIES = ['HIGH', 'MEDIUM', 'LOW', 'DIRECT_SUNLIGHT'];

export function AnalysisReviewForm({
  projectId,
  imageId,
  initialData,
  projectScope,
  onReviewSaved,
}: AnalysisReviewFormProps) {
  const [spaceType, setSpaceType] = useState(initialData.spaceType || 'LIVING_ROOM');
  const [isInterior, setIsInterior] = useState(initialData.isInterior ?? true);
  const [architecturalStyle, setArchitecturalStyle] = useState(initialData.architecturalStyle || 'CONTEMPORARY');
  const [naturalLightQuality, setNaturalLightQuality] = useState(initialData.naturalLightQuality || 'MEDIUM');
  const [surfaces, setSurfaces] = useState<string[]>(() => {
    try {
      return initialData.visibleSurfaces ? JSON.parse(initialData.visibleSurfaces) : ['PLASTER'];
    } catch {
      return ['PLASTER'];
    }
  });

  const [saving, setSaving] = useState(false);
  const [currentState, setCurrentState] = useState(initialData.analysisState || AnalysisState.AI_INFERRED);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setWarnings([]);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/images/${imageId}/analysis`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceType,
          isInterior,
          architecturalStyle,
          naturalLightQuality,
          visibleSurfaces: surfaces,
          applicationScope: projectScope,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update analysis');
      }

      setCurrentState(data.analysisState);
      if (data.warnings && data.warnings.length > 0) {
        setWarnings(data.warnings);
      }
      setSuccessMsg('Analysis review saved successfully!');
      onReviewSaved?.(data.analysisResult);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getBadgeClass = (state: string) => {
    switch (state) {
      case AnalysisState.USER_OVERRIDDEN:
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
      case AnalysisState.USER_CONFIRMED:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
      default:
        return 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">AI Visual Analysis Review</h3>
          <p className="text-xs text-zinc-500">
            Verify or correct features detected by Gemini Vision for precision recommendations.
          </p>
        </div>
        <div className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getBadgeClass(currentState)}`}>
          {currentState === AnalysisState.USER_OVERRIDDEN && 'User Overridden'}
          {currentState === AnalysisState.USER_CONFIRMED && 'User Confirmed'}
          {currentState === AnalysisState.AI_INFERRED && 'AI Inferred'}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="my-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">Consistency Warning:</p>
          <ul className="list-disc list-inside">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {successMsg && (
        <div className="my-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Space Type</label>
          <select
            value={spaceType}
            onChange={(e) => setSpaceType(e.target.value)}
            className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 text-sm"
          >
            {SPACE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Orientation</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsInterior(true)}
              className={`flex-1 py-2 text-xs font-medium rounded-md border ${
                isInterior
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              Interior
            </button>
            <button
              type="button"
              onClick={() => setIsInterior(false)}
              className={`flex-1 py-2 text-xs font-medium rounded-md border ${
                !isInterior
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              Exterior
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Architectural Style</label>
          <select
            value={architecturalStyle}
            onChange={(e) => setArchitecturalStyle(e.target.value)}
            className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 text-sm"
          >
            {ARCHITECTURAL_STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Natural Light Quality</label>
          <select
            value={naturalLightQuality}
            onChange={(e) => setNaturalLightQuality(e.target.value)}
            className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 text-sm"
          >
            {LIGHT_QUALITIES.map((q) => (
              <option key={q} value={q}>
                {q.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Visible Surfaces (comma-separated)
          </label>
          <input
            type="text"
            value={surfaces.join(', ')}
            onChange={(e) =>
              setSurfaces(
                e.target.value
                  .split(',')
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean)
              )
            }
            className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 text-sm"
            placeholder="PLASTER, CONCRETE, WOOD"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Confirm / Save Review'}
        </button>
      </div>
    </div>
  );
}
