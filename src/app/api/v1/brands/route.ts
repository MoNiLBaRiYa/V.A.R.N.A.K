import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const CANONICAL_BRANDS = [
  {
    name: 'Asian Paints',
    slug: 'asian-paints',
    isActive: true,
    hasCatalogue: true,
    isAvailable: true,
  },
  {
    name: 'Berger Paints',
    slug: 'berger-paints',
    isActive: false,
    hasCatalogue: false,
    isAvailable: false,
    statusNote: 'Coming Soon',
  },
  {
    name: 'Kansai Nerolac',
    slug: 'nerolac',
    isActive: false,
    hasCatalogue: false,
    isAvailable: false,
    statusNote: 'Coming Soon',
  },
  {
    name: 'Birla Opus',
    slug: 'birla-opus',
    isActive: false,
    hasCatalogue: false,
    isAvailable: false,
    statusNote: 'Coming Soon',
  },
];

export async function GET() {
  try {
    // Attempt to query database brands if seeded
    const dbBrands = await prisma.paintBrand.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    // Merge canonical metadata with DB ids if present
    const brands = CANONICAL_BRANDS.map((cb) => {
      const match = dbBrands.find((db) => db.slug === cb.slug);
      return {
        id: match ? match.id : cb.slug,
        name: cb.name,
        slug: cb.slug,
        isActive: cb.isActive,
        hasCatalogue: cb.hasCatalogue,
        isAvailable: cb.isAvailable,
        statusNote: cb.statusNote,
        productCount: match ? match._count.products : (cb.hasCatalogue ? 4 : 0),
      };
    });

    return NextResponse.json({ brands });
  } catch (error: any) {
    logger.error({ error }, '[BrandsRoute] GET failed, returning fallback canonical brands');
    return NextResponse.json({ brands: CANONICAL_BRANDS });
  }
}
