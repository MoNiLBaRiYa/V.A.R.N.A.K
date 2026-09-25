import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  ProjectService,
  ProjectNotFoundError,
  ProjectForbiddenError,
} from '@/lib/projects/service';

interface RouteParams {
  params: { id: string };
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const project = await ProjectService.archiveProject(user.internalUserId, params.id);
    return NextResponse.json({ success: true, project });
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
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to archive project' } },
      { status: 500 }
    );
  }
}
