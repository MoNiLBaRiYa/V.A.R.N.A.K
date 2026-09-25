'use client';

import React, { useState } from 'react';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { ProjectList } from '@/components/projects/ProjectList';

interface DashboardClientWrapperProps {
  initialActiveProjects: any[];
  initialArchivedProjects: any[];
}

export function DashboardClientWrapper({
  initialActiveProjects,
  initialArchivedProjects,
}: DashboardClientWrapperProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProjects, setActiveProjects] = useState(initialActiveProjects);

  const handleCreated = (newProject: any) => {
    setActiveProjects((prev) => [newProject, ...prev]);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Projects Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your properties, photo visual inspections, and climate paint recommendations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Create New Project
        </button>
      </div>

      <ProjectList
        initialActiveProjects={activeProjects}
        initialArchivedProjects={initialArchivedProjects}
      />

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
