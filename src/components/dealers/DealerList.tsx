'use client';

import React from 'react';
import { DiscoveredDealer } from '@/lib/dealers/discovery-service';

interface DealerListProps {
  dealers: DiscoveredDealer[];
  brandName?: string;
}

export function DealerList({ dealers, brandName = 'Asian Paints' }: DealerListProps) {
  if (!dealers || dealers.length === 0) {
    return (
      <div className="p-6 text-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
        <p className="text-xs text-zinc-500">No authorized or discovered dealers found nearby.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Nearby {brandName} Dealers</h3>
          <p className="text-xs text-zinc-500">Discovered retailers within driving radius.</p>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium">
          {dealers.length} Discovered
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {dealers.map((dealer) => (
          <div
            key={dealer.id}
            className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col justify-between hover:border-zinc-300 transition-all shadow-sm"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                  {dealer.name}
                </h4>
                {dealer.distanceKm !== undefined && (
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    {dealer.distanceKm} km
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{dealer.address}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                Third-Party Discovered
              </span>
              <a
                href={`https://maps.google.com/?q=${dealer.latitude},${dealer.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Directions →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
