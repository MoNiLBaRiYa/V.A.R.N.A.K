'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  location?: {
    resolvedAddress?: string | null;
    rawInput: string;
  } | null;
  _count?: {
    images: number;
    recommendationRuns: number;
  };
}

interface ProjectListProps {
  initialActiveProjects: ProjectItem[];
  initialArchivedProjects: ProjectItem[];
}

export function ProjectList({
  initialActiveProjects,
  initialArchivedProjects,
}: ProjectListProps) {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [activeProjects, setActiveProjects] = useState<ProjectItem[]>(initialActiveProjects);
  const [archivedProjects, setArchivedProjects] = useState<ProjectItem[]>(initialArchivedProjects);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleArchive = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/v1/projects/${id}/archive`, { method: 'POST' });
      if (res.ok) {
        const archivedItem = activeProjects.find((p) => p.id === id);
        if (archivedItem) {
          setActiveProjects((prev) => prev.filter((p) => p.id !== id));
          setArchivedProjects((prev) => [
            { ...archivedItem, status: 'ARCHIVED', archivedAt: new Date().toISOString() },
            ...prev,
          ]);
        }
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handleUnarchive = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/v1/projects/${id}/unarchive`, { method: 'POST' });
      if (res.ok) {
        const unarchivedItem = archivedProjects.find((p) => p.id === id);
        if (unarchivedItem) {
          setArchivedProjects((prev) => prev.filter((p) => p.id !== id));
          setActiveProjects((prev) => [
            { ...unarchivedItem, status: 'ACTIVE', archivedAt: null },
            ...prev,
          ]);
        }
      }
    } finally {
      setLoadingId(null);
    }
  };

  const currentList = activeTab === 'ACTIVE' ? activeProjects : archivedProjects;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVE')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'ACTIVE'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Active Projects ({activeProjects.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ARCHIVED')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'ARCHIVED'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Archived ({archivedProjects.length})
        </button>
      </div>

      {/* Grid */}
      {currentList.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500 text-sm font-medium">
            {activeTab === 'ACTIVE'
              ? 'No active projects found. Click "Create Project" to get started!'
              : 'No archived projects.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentList.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1"
                  >
                    {project.name}
                  </Link>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      project.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                {project.description && (
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="font-medium">Location:</span>
                    <span className="truncate">
                      {project.location?.resolvedAddress || project.location?.rawInput || 'Not specified'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span>{project._count?.images || 0} Photos</span>
                    <span>•</span>
                    <span>{project._count?.recommendationRuns || 0} Runs</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs">
                <Link
                  href={`/projects/${project.id}`}
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  View Details →
                </Link>

                {activeTab === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={() => handleArchive(project.id)}
                    disabled={loadingId === project.id}
                    className="text-slate-400 hover:text-amber-600 transition-colors"
                  >
                    {loadingId === project.id ? 'Archiving...' : 'Archive'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUnarchive(project.id)}
                    disabled={loadingId === project.id}
                    className="text-slate-400 hover:text-emerald-600 transition-colors"
                  >
                    {loadingId === project.id ? 'Restoring...' : 'Unarchive'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
