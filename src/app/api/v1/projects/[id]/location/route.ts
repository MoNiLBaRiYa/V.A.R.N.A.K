import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService, ProjectForbiddenError, ProjectNotFoundError } from '@/lib/projects/service';
import { GeocodingService } from '@/lib/location/service';
import { GeocodingError } from '@/lib/location/google-geocoding';

const locationResolveSchema = z.object({
  rawInput: z.string().min(2, 'Address or PIN code is required').max(200),
});

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Ownership check
    await ProjectService.getProjectById(user.internalUserId, params.id);

    const body = await req.json();
    const parseResult = locationResolveSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid location query',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const resolved = await GeocodingService.resolveLocation(parseResult.data.rawInput);
    return NextResponse.json({ resolved });
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
    if (error instanceof GeocodingError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Geocoding service failed' } },
      { status: 500 }
    );
  }
}
