import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService } from '@/lib/projects/service';
import { DashboardClientWrapper } from '@/components/projects/DashboardClientWrapper';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Mandatory privacy & AI disclosure consent check
  if (!user.profile?.privacyAcceptedAt || !user.profile?.aiDisclosureAcceptedAt) {
    redirect('/auth/consent');
  }

  const [activeProjects, archivedProjects] = await Promise.all([
    ProjectService.listActiveProjects(user.internalUserId),
    ProjectService.listArchivedProjects(user.internalUserId),
  ]);

  // Serialize dates for client component
  const serializeProject = (p: any) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    archivedAt: p.archivedAt?.toISOString() || null,
  });

  const serializedActive = activeProjects.map(serializeProject);
  const serializedArchived = archivedProjects.map(serializeProject);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight text-slate-900">
              V.A.R.N.A.K.
            </span>
            <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
              MVP Core
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600 hidden sm:inline">
              Welcome, <strong className="text-slate-900">{user.profile?.name || user.email}</strong>
            </span>
            <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-600 font-mono">
              {user.role}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardClientWrapper
          initialActiveProjects={serializedActive}
          initialArchivedProjects={serializedArchived}
        />
      </main>
    </div>
  );
}
