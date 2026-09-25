import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProjectService } from '@/lib/projects/service';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const projects = await ProjectService.listArchivedProjects(user.internalUserId);
  return NextResponse.json({ projects });
}
