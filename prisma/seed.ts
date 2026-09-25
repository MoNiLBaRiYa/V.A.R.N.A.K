import { PrismaClient } from '@prisma/client';
import { Provenance } from '../src/types/enums';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed for V.A.R.N.A.K. Wave 0...');

  // 1. Seed the 4 official PaintBrand records
  const brands = [
    { name: 'Asian Paints', slug: 'asian-paints', isActive: true },
    { name: 'Birla Opus', slug: 'birla-opus', isActive: true },
    { name: 'Nerolac', slug: 'nerolac', isActive: true },
    { name: 'Berger Paints', slug: 'berger-paints', isActive: true },
  ];

  for (const b of brands) {
    await prisma.paintBrand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, isActive: b.isActive },
      create: b,
    });
    console.log(`[Seed] PaintBrand seeded: ${b.name}`);
  }

  // 2. Seed initial DataSource records
  const dataSources = [
    {
      name: 'Open-Meteo',
      category: 'CLIMATE',
      provenance: Provenance.VERIFIED,
      providerUrl: 'https://open-meteo.com',
      isActive: true,
    },
    {
      name: 'Google Geocoding',
      category: 'GEOCODING',
      provenance: Provenance.VERIFIED,
      providerUrl: 'https://maps.googleapis.com',
      isActive: true,
    },
    {
      name: 'Google Places',
      category: 'DEALER_DISCOVERY',
      provenance: Provenance.DERIVED,
      providerUrl: 'https://maps.googleapis.com',
      isActive: true,
    },
    {
      name: 'Manufacturer Catalogues',
      category: 'CATALOGUE',
      provenance: Provenance.VERIFIED,
      providerUrl: 'https://varnak.in/catalogues',
      isActive: true,
    },
  ];

  for (const ds of dataSources) {
    await prisma.dataSource.upsert({
      where: { name: ds.name },
      update: { category: ds.category, provenance: ds.provenance, providerUrl: ds.providerUrl, isActive: ds.isActive },
      create: ds,
    });
    console.log(`[Seed] DataSource seeded: ${ds.name}`);
  }

  // 3. Seed default active ScoringWeightVersion (v1.0.0)
  const initialWeights = {
    CLIMATE_SUITABILITY: 0.20,
    INTERIOR_EXTERIOR_COMPATIBILITY: 0.15,
    SURFACE_COMPATIBILITY: 0.15,
    PRODUCT_SUITABILITY: 0.10,
    ARCHITECTURAL_CHARACTERISTICS: 0.10,
    ROOM_TYPE: 0.10,
    NATURAL_LIGHT: 0.10,
    COLOUR_FAMILY_COMPATIBILITY: 0.05,
    USER_PREFERENCES: 0.05,
  };

  await prisma.scoringWeightVersion.upsert({
    where: { version: 'v1.0.0' },
    update: {
      weights: JSON.stringify(initialWeights),
      isActive: true,
      description: 'Initial baseline 9-factor recommendation scoring weights',
    },
    create: {
      version: 'v1.0.0',
      weights: JSON.stringify(initialWeights),
      isActive: true,
      description: 'Initial baseline 9-factor recommendation scoring weights',
      createdBy: 'SYSTEM_SEED',
    },
  });
  console.log('[Seed] ScoringWeightVersion seeded: v1.0.0 (active)');

  console.log('[Seed] Wave 0 seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
