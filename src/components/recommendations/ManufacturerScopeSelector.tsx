'use client';

import React from 'react';
import { ApplicationScope } from '@/types/enums';

export interface BrandOption {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  hasCatalogue: boolean;
  statusNote?: string;
}

interface ManufacturerScopeSelectorProps {
  brands?: BrandOption[];
  selectedBrandSlug: string;
  selectedScope: ApplicationScope;
  onBrandChange: (brandSlug: string) => void;
  onScopeChange: (scope: ApplicationScope) => void;
  disabled?: boolean;
}

const DEFAULT_BRANDS: BrandOption[] = [
  { id: '1', name: 'Asian Paints', slug: 'asian-paints', isActive: true, hasCatalogue: true },
  { id: '2', name: 'Berger Paints', slug: 'berger-paints', isActive: false, hasCatalogue: false, statusNote: 'Coming Soon' },
  { id: '3', name: 'Kansai Nerolac', slug: 'nerolac', isActive: false, hasCatalogue: false, statusNote: 'Coming Soon' },
  { id: '4', name: 'Birla Opus', slug: 'birla-opus', isActive: false, hasCatalogue: false, statusNote: 'Coming Soon' },
];

export function ManufacturerScopeSelector({
  brands = DEFAULT_BRANDS,
  selectedBrandSlug,
  selectedScope,
  onBrandChange,
  onScopeChange,
  disabled = false,
}: ManufacturerScopeSelectorProps) {
  return (
    <div className="space-y-6">
      {/* 1. Manufacturer Selection */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
          Select Paint Manufacturer
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {brands.map((b) => {
            const isSelected = selectedBrandSlug === b.slug;
            const isClickable = b.isActive && !disabled;

            return (
              <div
                key={b.slug}
                onClick={() => isClickable && onBrandChange(b.slug)}
                className={`relative rounded-xl border p-4 transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                    : isClickable
                    ? 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 cursor-pointer'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{b.name}</h4>
                  {b.isActive ? (
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
                  {b.isActive ? 'Verified architectural catalogue' : 'Integration scheduled for Wave 2'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Application Scope Selection */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
          Application Scope
        </label>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          {[
            { scope: ApplicationScope.INTERIOR, label: 'Interior Only' },
            { scope: ApplicationScope.EXTERIOR, label: 'Exterior Only' },
            { scope: ApplicationScope.BOTH, label: 'Both (Whole Project)' },
          ].map(({ scope, label }) => {
            const isSelected = selectedScope === scope;
            return (
              <button
                key={scope}
                type="button"
                disabled={disabled}
                onClick={() => onScopeChange(scope)}
                className={`py-2.5 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-400 mt-2">
          Scope filters candidate shades based on manufacturer formulation and surface durability specifications.
        </p>
      </div>
    </div>
  );
}
