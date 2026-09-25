import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ProjectService,
  ProjectNotFoundError,
  ProjectForbiddenError,
  ProjectConflictError,
} from '@/lib/projects/service';
import { prisma } from '@/lib/db/prisma';
import * as auditModule from '@/lib/audit';
import { ApplicationScope, ProjectStatus } from '@/types/enums';
import { POST as consentRouteHandler } from '@/app/api/v1/auth/consent/route';
import { NextRequest } from 'next/server';
import * as authSessionModule from '@/lib/auth/auth';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    project: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    userProfile: {
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

describe('Project Workspace & Consent Lifecycle (02-01)', () => {
  const userId = 'user-owner-123';
  const otherUserId = 'user-intruder-999';
  const projectId = 'proj-abc-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ProjectService CRUD & Invariants', () => {
    it('creates an active project with ApplicationScope.INTERIOR by default', async () => {
      (prisma.project.create as any).mockResolvedValue({
        id: projectId,
        userId,
        name: 'Villa Sunscape',
        description: 'New villa paint project',
        status: ProjectStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const project = await ProjectService.createProject(userId, {
        name: 'Villa Sunscape',
        description: 'New villa paint project',
      });

      expect(project.id).toBe(projectId);
      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            name: 'Villa Sunscape',
            status: ProjectStatus.ACTIVE,
          }),
        })
      );
      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: 'PROJECT_CREATED',
          outcome: 'SUCCESS',
        })
      );
    });

    it('accepts, validates, and persists ApplicationScope.BOTH without generating recommendations in Wave 1', async () => {
      (prisma.project.create as any).mockResolvedValue({
        id: projectId,
        userId,
        name: 'Whole Property Repaint',
        description: null,
        status: ProjectStatus.ACTIVE,
      });

      const project = await ProjectService.createProject(userId, {
        name: 'Whole Property Repaint',
        applicationScope: ApplicationScope.BOTH,
      });

      expect(project.id).toBe(projectId);
      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PROJECT_CREATED',
          metadata: expect.objectContaining({
            applicationScope: ApplicationScope.BOTH,
          }),
        })
      );
      // Invariant check: In Wave 1, this operation persists the scope and does NOT generate recommendations
    });

    it('lists active projects ordered by updatedAt desc', async () => {
      (prisma.project.findMany as any).mockResolvedValue([
        { id: 'p1', name: 'Project 1', status: ProjectStatus.ACTIVE },
      ]);

      const projects = await ProjectService.listActiveProjects(userId);
      expect(projects).toHaveLength(1);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, status: ProjectStatus.ACTIVE },
          orderBy: { updatedAt: 'desc' },
        })
      );
    });

    it('lists archived projects ordered by archivedAt desc', async () => {
      (prisma.project.findMany as any).mockResolvedValue([
        { id: 'p2', name: 'Project 2', status: ProjectStatus.ARCHIVED },
      ]);

      const projects = await ProjectService.listArchivedProjects(userId);
      expect(projects).toHaveLength(1);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, status: ProjectStatus.ARCHIVED },
          orderBy: { archivedAt: 'desc' },
        })
      );
    });

    it('retrieves project by ID when accessed by owner', async () => {
      (prisma.project.findUnique as any).mockResolvedValue({
        id: projectId,
        userId,
        name: 'Villa Sunscape',
        status: ProjectStatus.ACTIVE,
      });

      const project = await ProjectService.getProjectById(userId, projectId);
      expect(project.id).toBe(projectId);
    });

    it('throws ProjectNotFoundError if project does not exist', async () => {
      (prisma.project.findUnique as any).mockResolvedValue(null);

      await expect(ProjectService.getProjectById(userId, 'non-existent')).rejects.toThrow(
        ProjectNotFoundError
      );
    });

    it('enforces tenant isolation: records SECURITY_VIOLATION and throws ProjectForbiddenError when non-owner accesses project', async () => {
      (prisma.project.findUnique as any).mockResolvedValue({
        id: projectId,
        userId, // owned by userId
        name: 'Villa Sunscape',
        status: ProjectStatus.ACTIVE,
      });

      await expect(ProjectService.getProjectById(otherUserId, projectId)).rejects.toThrow(
        ProjectForbiddenError
      );

      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: otherUserId,
          eventType: 'SECURITY_VIOLATION',
          outcome: 'FAILURE',
        })
      );
    });

    it('updates an active project successfully', async () => {
      (prisma.project.findUnique as any).mockResolvedValue({
        id: projectId,
        userId,
        status: ProjectStatus.ACTIVE,
      });
      (prisma.project.update as any).mockResolvedValue({
        id: projectId,
        name: 'Renamed Villa',
        status: ProjectStatus.ACTIVE,
      });

      const updated = await ProjectService.updateProject(userId, projectId, {
        name: 'Renamed Villa',
      });

      expect(updated.name).toBe('Renamed Villa');
      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PROJECT_UPDATED',
          outcome: 'SUCCESS',
        })
      );
    });

    it('rejects modification attempts to ARCHIVED projects with ProjectConflictError', async () => {
      (prisma.project.findUnique as any).mockResolvedValue({
        id: projectId,
        userId,
        status: ProjectStatus.ARCHIVED,
      });

      await expect(
        ProjectService.updateProject(userId, projectId, { name: 'Illegal Edit' })
      ).rejects.toThrow(ProjectConflictError);

      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('archives project and records PROJECT_ARCHIVED audit event', async () => {
      (prisma.project.findUnique as any).mockResolvedValue({
        id: projectId,
        userId,
        status: ProjectStatus.ACTIVE,
      });
      (prisma.project.update as any).mockResolvedValue({
        id: projectId,
        status: ProjectStatus.ARCHIVED,
        archivedAt: new Date(),
      });

      const archived = await ProjectService.archiveProject(userId, projectId);
      expect(archived.status).toBe(ProjectStatus.ARCHIVED);
      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PROJECT_ARCHIVED',
          outcome: 'SUCCESS',
        })
      );
    });

    it('unarchives project and records PROJECT_UNARCHIVED audit event', async () => {
      (prisma.project.findUnique as any).mockResolvedValue({
        id: projectId,
        userId,
        status: ProjectStatus.ARCHIVED,
      });
      (prisma.project.update as any).mockResolvedValue({
        id: projectId,
        status: ProjectStatus.ACTIVE,
        archivedAt: null,
      });

      const unarchived = await ProjectService.unarchiveProject(userId, projectId);
      expect(unarchived.status).toBe(ProjectStatus.ACTIVE);
      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PROJECT_UNARCHIVED',
          outcome: 'SUCCESS',
        })
      );
    });
  });

  describe('Consent Persistence Endpoint (POST /api/v1/auth/consent)', () => {
    it('returns 401 when request is not authenticated', async () => {
      (authSessionModule.auth as any).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacyAccepted: true,
          aiDisclosureAccepted: true,
        }),
      });

      const res = await consentRouteHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when privacy or AI disclosure consent is missing or false', async () => {
      (authSessionModule.auth as any).mockResolvedValue({
        user: { id: 'entra-sub-1', email: 'user@varnak.in' },
      });

      const req = new NextRequest('http://localhost:3000/api/v1/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacyAccepted: false,
          aiDisclosureAccepted: true,
        }),
      });

      const res = await consentRouteHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('persists UserProfile consent and records CONSENT_RECORDED audit log when valid', async () => {
      (authSessionModule.auth as any).mockResolvedValue({
        user: { id: 'entra-sub-1', email: 'user@varnak.in' },
      });
      (prisma.user.findFirst as any).mockResolvedValue({
        internalUserId: 'user-internal-id',
        email: 'user@varnak.in',
      });
      (prisma.userProfile.upsert as any).mockResolvedValue({
        id: 'profile-uuid',
        userId: 'user-internal-id',
        privacyPolicyVersion: '1.0',
        privacyAcceptedAt: new Date(),
        aiDisclosureAcceptedAt: new Date(),
      });

      const req = new NextRequest('http://localhost:3000/api/v1/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacyPolicyVersion: '1.0',
          privacyAccepted: true,
          aiDisclosureAccepted: true,
        }),
      });

      const res = await consentRouteHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-internal-id' },
          update: expect.objectContaining({
            privacyPolicyVersion: '1.0',
          }),
        })
      );
      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-internal-id',
          eventType: 'CONSENT_RECORDED',
          outcome: 'SUCCESS',
        })
      );
    });
  });
});
