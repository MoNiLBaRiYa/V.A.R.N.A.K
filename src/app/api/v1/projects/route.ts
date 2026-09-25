import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService } from '@/lib/projects/service';
import { ApplicationScope } from '@/types/enums';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  applicationScope: z.nativeEnum(ApplicationScope).optional().default(ApplicationScope.INTERIOR),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const projects = await ProjectService.listActiveProjects(user.internalUserId);
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parseResult = createProjectSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid project data',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const project = await ProjectService.createProject(user.internalUserId, parseResult.data);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create project' } },
      { status: 500 }
    );
  }
}
