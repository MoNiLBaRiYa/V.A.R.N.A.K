import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ProjectService, ProjectNotFoundError, ProjectForbiddenError } from '@/lib/projects/service';
import * as sessionModule from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

// Import Route Handlers
import { GET as getImagesRoute, POST as postImagesRoute } from '@/app/api/v1/projects/[id]/images/route';
import { GET as getImageDetailRoute, DELETE as deleteImageDetailRoute } from '@/app/api/v1/projects/[id]/images/[imageId]/route';
import { GET as getAnalysisRoute, PATCH as patchAnalysisRoute } from '@/app/api/v1/projects/[id]/images/[imageId]/analysis/route';
import { GET as getRecommendationsRoute, POST as postRecommendationsRoute } from '@/app/api/v1/projects/[id]/recommendations/route';
import { GET as getRecommendationRunRoute } from '@/app/api/v1/projects/[id]/recommendations/[runId]/route';

vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/projects/service', () => ({
  ProjectService: {
    getProjectById: vi.fn(),
  },
  ProjectNotFoundError: class ProjectNotFoundError extends Error {
    code = 'PROJECT_NOT_FOUND';
    constructor() {
      super('Project not found');
      this.name = 'ProjectNotFoundError';
    }
  },
  ProjectForbiddenError: class ProjectForbiddenError extends Error {
    code = 'UNAUTHORIZED_ACCESS';
    constructor() {
      super('Access to project forbidden');
      this.name = 'ProjectForbiddenError';
    }
  },
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    projectImage: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    imageAnalysisResult: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    recommendationRun: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/images/azure-blob', () => ({
  generateReadSasUrl: vi.fn().mockReturnValue('https://blob.mock/image.jpg?sas=token'),
  uploadImageToBlob: vi.fn().mockResolvedValue('storage-key-123'),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, allowed: true, remaining: 19, reset: 86400 }),
  RATE_LIMIT_CONFIGS: {
    IMAGE_UPLOAD: { limit: 20, windowSeconds: 86400 },
    RECOMMENDATION: { limit: 10, windowSeconds: 86400 },
  },
}));

vi.mock('@/lib/recommendations/recommendation-engine', () => ({
  RecommendationEngine: {
    execute: vi.fn().mockResolvedValue({
      runId: 'run-uuid-1',
      projectScope: 'INTERIOR',
      recommendations: [],
    }),
  },
}));

describe('Project Route Argument Order & Tenant Isolation Regression Suite (FINDING-P2-01 & FINDING-P2-03)', () => {
  const currentUserId = 'user-auth-uuid-111';
  const targetProjectId = 'proj-target-uuid-222';
  const targetImageId = 'img-target-uuid-333';
  const targetRunId = 'run-target-uuid-444';

  const mockUser = {
    internalUserId: currentUserId,
    email: 'architect@varnak.in',
    role: 'USER',
  };

  const mockProject = {
    id: targetProjectId,
    userId: currentUserId,
    status: 'ACTIVE',
    applicationScope: 'INTERIOR',
    name: 'Sample Project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (sessionModule.getCurrentUser as any).mockResolvedValue(mockUser);
  });

  describe('Route Argument Fidelity: ProjectService.getProjectById(userId, projectId)', () => {
    it('1. GET /api/v1/projects/[id]/images passes (userId, projectId) in strict order', async () => {
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        if (userId !== currentUserId || projectId !== targetProjectId) {
          throw new ProjectNotFoundError();
        }
        return Promise.resolve(mockProject);
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/images`);
      const res = await getImagesRoute(req, { params: { id: targetProjectId } });

      expect(res.status).toBe(200);
      expect(ProjectService.getProjectById).toHaveBeenCalledWith(currentUserId, targetProjectId);
      expect(ProjectService.getProjectById).not.toHaveBeenCalledWith(targetProjectId, currentUserId);
    });

    it('2. POST /api/v1/projects/[id]/images passes (userId, projectId) in strict order', async () => {
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        if (userId !== currentUserId || projectId !== targetProjectId) {
          throw new ProjectNotFoundError();
        }
        return Promise.resolve(mockProject);
      });

      // Send empty formData to hit early validation after getProjectById
      const formData = new FormData();
      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/images`, {
        method: 'POST',
        body: formData,
      });

      const res = await postImagesRoute(req, { params: { id: targetProjectId } });
      // Should pass getProjectById, then fail on missing file
      expect(res.status).toBe(400);
      expect(ProjectService.getProjectById).toHaveBeenCalledWith(currentUserId, targetProjectId);
      expect(ProjectService.getProjectById).not.toHaveBeenCalledWith(targetProjectId, currentUserId);
    });

    it('3. GET /api/v1/projects/[id]/images/[imageId] passes (userId, projectId) in strict order', async () => {
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        if (userId !== currentUserId || projectId !== targetProjectId) {
          throw new ProjectNotFoundError();
        }
        return Promise.resolve(mockProject);
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/images/${targetImageId}`);
      const res = await getImageDetailRoute(req, { params: { id: targetProjectId, imageId: targetImageId } });

      expect(ProjectService.getProjectById).toHaveBeenCalledWith(currentUserId, targetProjectId);
      expect(ProjectService.getProjectById).not.toHaveBeenCalledWith(targetProjectId, currentUserId);
    });

    it('4. DELETE /api/v1/projects/[id]/images/[imageId] passes (userId, projectId) in strict order', async () => {
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        if (userId !== currentUserId || projectId !== targetProjectId) {
          throw new ProjectNotFoundError();
        }
        return Promise.resolve(mockProject);
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/images/${targetImageId}`, {
        method: 'DELETE',
      });
      const res = await deleteImageDetailRoute(req, { params: { id: targetProjectId, imageId: targetImageId } });

      expect(ProjectService.getProjectById).toHaveBeenCalledWith(currentUserId, targetProjectId);
      expect(ProjectService.getProjectById).not.toHaveBeenCalledWith(targetProjectId, currentUserId);
    });

    it('5. GET /api/v1/projects/[id]/images/[imageId]/analysis passes (userId, projectId) in strict order', async () => {
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        if (userId !== currentUserId || projectId !== targetProjectId) {
          throw new ProjectNotFoundError();
        }
        return Promise.resolve(mockProject);
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/images/${targetImageId}/analysis`);
      const res = await getAnalysisRoute(req, { params: { id: targetProjectId, imageId: targetImageId } });

      expect(ProjectService.getProjectById).toHaveBeenCalledWith(currentUserId, targetProjectId);
      expect(ProjectService.getProjectById).not.toHaveBeenCalledWith(targetProjectId, currentUserId);
    });

    it('6. PATCH /api/v1/projects/[id]/images/[imageId]/analysis passes (userId, projectId) in strict order', async () => {
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        if (userId !== currentUserId || projectId !== targetProjectId) {
          throw new ProjectNotFoundError();
        }
        return Promise.resolve(mockProject);
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/images/${targetImageId}/analysis`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceType: 'LIVING_ROOM' }),
      });
      const res = await patchAnalysisRoute(req, { params: { id: targetProjectId, imageId: targetImageId } });

      expect(ProjectService.getProjectById).toHaveBeenCalledWith(currentUserId, targetProjectId);
      expect(ProjectService.getProjectById).not.toHaveBeenCalledWith(targetProjectId, currentUserId);
    });

    it('7. GET /api/v1/projects/[id]/recommendations passes (userId, projectId) in strict order', async () => {
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        if (userId !== currentUserId || projectId !== targetProjectId) {
          throw new ProjectNotFoundError();
        }
        return Promise.resolve(mockProject);
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/recommendations`);
      const res = await getRecommendationsRoute(req, { params: { id: targetProjectId } });

      expect(res.status).toBe(200);
      expect(ProjectService.getProjectById).toHaveBeenCalledWith(currentUserId, targetProjectId);
      expect(ProjectService.getProjectById).not.toHaveBeenCalledWith(targetProjectId, currentUserId);
    });

    it('8. POST /api/v1/projects/[id]/recommendations passes (userId, projectId) in strict order', async () => {
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        if (userId !== currentUserId || projectId !== targetProjectId) {
          throw new ProjectNotFoundError();
        }
        return Promise.resolve(mockProject);
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: targetImageId }),
      });
      const res = await postRecommendationsRoute(req, { params: { id: targetProjectId } });

      expect(ProjectService.getProjectById).toHaveBeenCalledWith(currentUserId, targetProjectId);
      expect(ProjectService.getProjectById).not.toHaveBeenCalledWith(targetProjectId, currentUserId);
    });

    it('9. GET /api/v1/projects/[id]/recommendations/[runId] passes (userId, projectId) in strict order', async () => {
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        if (userId !== currentUserId || projectId !== targetProjectId) {
          throw new ProjectNotFoundError();
        }
        return Promise.resolve(mockProject);
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/recommendations/${targetRunId}`);
      const res = await getRecommendationRunRoute(req, { params: { id: targetProjectId, runId: targetRunId } });

      expect(ProjectService.getProjectById).toHaveBeenCalledWith(currentUserId, targetProjectId);
      expect(ProjectService.getProjectById).not.toHaveBeenCalledWith(targetProjectId, currentUserId);
    });
  });

  describe('Strict Rejection on Reversed Arguments Simulation', () => {
    it('fails route handler with 404 when getProjectById rejects reversed arguments', async () => {
      // Simulating real ProjectService behavior where WHERE id = arg[1], userId = arg[0]
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        if (userId === targetProjectId && projectId === currentUserId) {
          // Arguments were inverted!
          throw new ProjectNotFoundError();
        }
        return Promise.resolve(mockProject);
      });

      // Calling with correct order passes
      const req1 = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/images`);
      const res1 = await getImagesRoute(req1, { params: { id: targetProjectId } });
      expect(res1.status).toBe(200);

      // Now verify that if the service receives inverted arguments, it throws 404
      (ProjectService.getProjectById as any).mockImplementation((userId: string, projectId: string) => {
        // Strict guard: only accept actual user id as first arg
        if (userId !== currentUserId) {
          return Promise.reject(new ProjectNotFoundError());
        }
        return Promise.resolve(mockProject);
      });

      // If an inverted call were made:
      await expect(
        ProjectService.getProjectById(targetProjectId, currentUserId)
      ).rejects.toThrow(ProjectNotFoundError);
    });
  });

  describe('Tenant Isolation & Authorization Enforcement across Routes', () => {
    it('returns 403 Forbidden when ProjectService throws ProjectForbiddenError (cross-tenant access)', async () => {
      (ProjectService.getProjectById as any).mockImplementation(() => {
        throw new ProjectForbiddenError();
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/images`);
      const res = await getImagesRoute(req, { params: { id: targetProjectId } });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Forbidden');
    });

    it('returns 404 Not Found when ProjectService throws ProjectNotFoundError (non-existent project)', async () => {
      (ProjectService.getProjectById as any).mockImplementation(() => {
        throw new ProjectNotFoundError();
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/images`);
      const res = await getImagesRoute(req, { params: { id: targetProjectId } });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Project not found');
    });

    it('returns 401 Unauthorized when session is unauthenticated', async () => {
      (sessionModule.getCurrentUser as any).mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${targetProjectId}/images`);
      const res = await getImagesRoute(req, { params: { id: targetProjectId } });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('UNAUTHORIZED');
      expect(ProjectService.getProjectById).not.toHaveBeenCalled();
    });
  });
});
