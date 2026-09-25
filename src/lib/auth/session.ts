import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(session.user.id ? [{ externalSubjectId: session.user.id }] : []),
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    },
    include: {
      profile: true,
    },
  });

  return user;
}
