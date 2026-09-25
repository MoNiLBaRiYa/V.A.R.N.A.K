import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { ApplicationScope, ProjectStatus } from '@/types/enums';

export class ProjectNotFoundError extends Error {
  constructor(message = 'Project not found') {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectForbiddenError extends Error {
  constructor(message = 'Access forbidden to project') {
    super(message);
    this.name = 'ProjectForbiddenError';
  }
}

export class ProjectConflictError extends Error {
  constructor(message = 'Cannot modify an archived project') {
    super(message);
    this.name = 'ProjectConflictError';
  }
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  applicationScope?: ApplicationScope | string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
}

export class ProjectService {
  /**
   * Create a new active project workspace
   */
  static async createProject(userId: string, input: CreateProjectInput) {
    const project = await prisma.project.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        status: ProjectStatus.ACTIVE,
      },
    });

    await recordAuditEvent({
      userId,
      eventType: 'PROJECT_CREATED',
      resourceType: 'Project',
      resourceId: project.id,
      outcome: 'SUCCESS',
      metadata: {
        name: project.name,
        applicationScope: input.applicationScope || ApplicationScope.INTERIOR,
      },
    });

    return project;
  }

  /**
   * List all active projects for a user
   */
  static async listActiveProjects(userId: string) {
    return prisma.project.findMany({
      where: {
        userId,
        status: ProjectStatus.ACTIVE,
      },
      include: {
        location: true,
        _count: {
          select: {
            images: true,
            recommendationRuns: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * List all archived projects for a user
   */
  static async listArchivedProjects(userId: string) {
    return prisma.project.findMany({
      where: {
        userId,
        status: ProjectStatus.ARCHIVED,
      },
      include: {
        location: true,
        _count: {
          select: {
            images: true,
            recommendationRuns: true,
          },
        },
      },
      orderBy: {
        archivedAt: 'desc',
      },
    });
  }

  /**
   * Get project by ID with tenant isolation & security verification
   */
  static async getProjectById(userId: string, projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        location: {
          include: {
            climateProfile: {
              include: {
                observations: true,
              },
            },
          },
        },
        images: {
          where: {
            processingState: { not: 'DELETED' },
          },
          include: {
            analysisResult: true,
          },
        },
        recommendationRuns: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!project) {
      throw new ProjectNotFoundError();
    }

    if (project.userId !== userId) {
      await recordAuditEvent({
        userId,
        eventType: 'SECURITY_VIOLATION',
        resourceType: 'Project',
        resourceId: projectId,
        outcome: 'FAILURE',
        metadata: {
          reason: 'Unauthorized project access attempt across tenants',
          targetProjectId: projectId,
        },
      });

      logger.warn({ userId, projectId }, '[ProjectService] Unauthorized cross-tenant access attempt');
      throw new ProjectForbiddenError();
    }

    return project;
  }

  /**
   * Update project details (rejects updates to ARCHIVED projects with 409)
   */
  static async updateProject(userId: string, projectId: string, input: UpdateProjectInput) {
    const existing = await this.getProjectById(userId, projectId);

    if (existing.status === ProjectStatus.ARCHIVED) {
      throw new ProjectConflictError('Cannot modify an archived project. Unarchive the project before editing.');
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });

    await recordAuditEvent({
      userId,
      eventType: 'PROJECT_UPDATED',
      resourceType: 'Project',
      resourceId: projectId,
      outcome: 'SUCCESS',
      metadata: {
        updatedFields: Object.keys(input),
      },
    });

    return updated;
  }

  /**
   * Archive a project (Design §23.1: POST /api/v1/projects/:id/archive)
   */
  static async archiveProject(userId: string, projectId: string) {
    const existing = await this.getProjectById(userId, projectId);

    if (existing.status === ProjectStatus.ARCHIVED) {
      return existing;
    }

    const archived = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await recordAuditEvent({
      userId,
      eventType: 'PROJECT_ARCHIVED',
      resourceType: 'Project',
      resourceId: projectId,
      outcome: 'SUCCESS',
    });

    return archived;
  }

  /**
   * Unarchive a project (Design §23.1: POST /api/v1/projects/:id/unarchive)
   */
  static async unarchiveProject(userId: string, projectId: string) {
    const existing = await this.getProjectById(userId, projectId);

    if (existing.status === ProjectStatus.ACTIVE) {
      return existing;
    }

    const unarchived = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.ACTIVE,
        archivedAt: null,
      },
    });

    await recordAuditEvent({
      userId,
      eventType: 'PROJECT_UNARCHIVED',
      resourceType: 'Project',
      resourceId: projectId,
      outcome: 'SUCCESS',
    });

    return unarchived;
  }
}
