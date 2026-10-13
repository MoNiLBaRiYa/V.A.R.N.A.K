import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService, ProjectForbiddenError, ProjectNotFoundError } from '@/lib/projects/service';
import { GeocodingService } from '@/lib/location/service';

const confirmLocationSchema = z.object({
  rawInput: z.string().min(1),
  resolvedAddress: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
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
    const body = await req.json();
    const parseResult = confirmLocationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid location confirmation data',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const location = await GeocodingService.confirmLocation(
      user.internalUserId,
      params.id,
      parseResult.data
    );

    return NextResponse.json({ success: true, location }, { status: 200 });
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
      { error: { code: 'INTERNAL_ERROR', message: (error as Error).message || 'Failed to confirm location' } },
      { status: 500 }
    );
  }
}
