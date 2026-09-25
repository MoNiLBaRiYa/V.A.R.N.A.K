import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import {
  ProjectService,
  ProjectNotFoundError,
  ProjectForbiddenError,
  ProjectConflictError,
} from '@/lib/projects/service';

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const project = await ProjectService.getProjectById(user.internalUserId, params.id);
    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }
    if (error instanceof ProjectForbiddenError) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access forbidden to project' } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve project' } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parseResult = updateProjectSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const updated = await ProjectService.updateProject(
      user.internalUserId,
      params.id,
      parseResult.data
    );
    return NextResponse.json({ project: updated });
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }
    if (error instanceof ProjectForbiddenError) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access forbidden to project' } },
        { status: 403 }
      );
    }
    if (error instanceof ProjectConflictError) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: error.message } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update project' } },
      { status: 500 }
    );
  }
}
