import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { DealerDiscoveryService } from '@/lib/dealers/discovery-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get('lat');
    const lonStr = searchParams.get('lon');
    const brandSlug = searchParams.get('brand') || 'asian-paints';

    if (!latStr || !lonStr) {
      return NextResponse.json(
        { error: 'Latitude and longitude query parameters are required', code: 'MISSING_COORDINATES' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Invalid numeric coordinates provided', code: 'INVALID_COORDINATES' },
        { status: 400 }
      );
    }

    const dealers = await DealerDiscoveryService.discoverDealers(latitude, longitude, brandSlug);

    return NextResponse.json({ dealers });
  } catch (error: any) {
    logger.error({ error }, '[DealersRoute] GET failed');
    return NextResponse.json({ error: error.message || 'Dealer search failed' }, { status: 500 });
  }
}
