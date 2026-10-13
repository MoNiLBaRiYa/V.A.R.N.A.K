'use client';

import React from 'react';

interface ClimateObservation {
  month: number;
  avgTempCelsius: number;
  avgHumidityPct: number;
  totalRainfallMm: number;
  avgUvIndex: number;
  avgWindSpeedKmh?: number | null;
}

interface ClimateProfileProps {
  profile: {
    provenance: string;
    climateDataNote?: string | null;
    observations: ClimateObservation[];
    dataSource?: { name: string } | null;
  } | null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ClimateDisplayCard({ profile }: ClimateProfileProps) {
  if (!profile || !profile.observations || profile.observations.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">
        No climate profile available. Confirm a location above to load meteorological analytics.
      </div>
    );
  }

  const obs = profile.observations;
  const avgTemp = (obs.reduce((acc, o) => acc + o.avgTempCelsius, 0) / obs.length).toFixed(1);
  const avgHumidity = (obs.reduce((acc, o) => acc + o.avgHumidityPct, 0) / obs.length).toFixed(0);
  const totalRain = Math.round(obs.reduce((acc, o) => acc + o.totalRainfallMm, 0));
  const maxUv = Math.max(...obs.map((o) => o.avgUvIndex)).toFixed(1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Climate Exposure Metrics</h3>
          <p className="text-xs text-slate-500">
            Source: {profile.dataSource?.name || 'Climatology Provider'} • Provenance: {profile.provenance}
          </p>
        </div>

        <span
          className={`self-start text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            profile.provenance === 'VERIFIED'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {profile.provenance === 'VERIFIED' ? 'Verified Hyperlocal Data' : 'Regional Climatology'}
        </span>
      </div>

      {profile.climateDataNote && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
          <span className="text-base font-bold leading-none">⚠</span>
          <div>
            <strong className="font-semibold">Notice:</strong> {profile.climateDataNote}
          </div>
        </div>
      )}

      {/* Summary KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-xs text-slate-500 font-medium">Mean Temp</span>
          <p className="text-xl font-black text-slate-900 mt-0.5">{avgTemp}°C</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-xs text-slate-500 font-medium">Mean Humidity</span>
          <p className="text-xl font-black text-slate-900 mt-0.5">{avgHumidity}%</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-xs text-slate-500 font-medium">Annual Rain</span>
          <p className="text-xl font-black text-slate-900 mt-0.5">{totalRain} mm</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-xs text-slate-500 font-medium">Peak UV Index</span>
          <p className="text-xl font-black text-slate-900 mt-0.5">{maxUv}</p>
        </div>
      </div>

      {/* 12-month table / bar cards */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          12-Month Observation Cycle
        </h4>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 text-center text-xs">
          {obs.map((o) => (
            <div key={o.month} className="p-2 rounded bg-slate-50 border border-slate-100 flex flex-col justify-between">
              <span className="font-bold text-slate-700">{MONTH_NAMES[o.month - 1]}</span>
              <div className="my-1.5 space-y-0.5 text-[10px]">
                <p className="text-slate-900 font-semibold">{o.avgTempCelsius}°</p>
                <p className="text-blue-600">{o.totalRainfallMm}mm</p>
                <p className="text-amber-600 font-mono">UV {o.avgUvIndex}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
