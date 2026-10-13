import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService, ProjectForbiddenError, ProjectNotFoundError } from '@/lib/projects/service';
import { ClimateService } from '@/lib/climate/service';

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

    if (!project.location) {
      return NextResponse.json(
        { error: { code: 'LOCATION_NOT_SET', message: 'Project location has not been confirmed' } },
        { status: 404 }
      );
    }

    const profile = await ClimateService.getProfileByProjectLocationId(project.location.id);

    if (!profile) {
      return NextResponse.json(
        { error: { code: 'CLIMATE_NOT_FOUND', message: 'Climate profile not available for this location' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile });
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
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve climate profile' } },
      { status: 500 }
    );
  }
}
