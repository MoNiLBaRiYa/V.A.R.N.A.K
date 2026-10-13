import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/db/prisma';
import { logger } from '../src/lib/logger';
import { Provenance } from '../src/types/enums';

export interface CatalogueData {
  brand: {
    name: string;
    slug: string;
    isActive: boolean;
  };
  dataSource: {
    name: string;
    category: string;
    provenance: string;
    providerUrl?: string;
  };
  products: Array<{
    name: string;
    formulation: string;
    finishType: string;
    applicationScope: string;
    surfaceCompatibility: string[];
  }>;
  shades: Array<{
    productName: string;
    shadeName: string;
    shadeCode: string;
    colourFamily: string;
    hexApprox: string;
    provenance: string;
  }>;
}

export async function importCatalogue(filePath?: string) {
  const targetPath =
    filePath ||
    path.join(process.cwd(), 'src', 'data', 'catalogues', 'asian-paints.json');

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Catalogue file not found at ${targetPath}`);
  }

  const raw = fs.readFileSync(targetPath, 'utf-8');
  const catalogue: CatalogueData = JSON.parse(raw);

  logger.info({ file: targetPath, brand: catalogue.brand.name }, '[CatalogueImporter] Starting catalogue import');

  // 1. Ensure DataSource exists
  const dataSource = await prisma.dataSource.upsert({
    where: { name: catalogue.dataSource.name },
    update: {
      category: catalogue.dataSource.category,
      provenance: Provenance.VERIFIED,
      providerUrl: catalogue.dataSource.providerUrl,
      lastUpdatedAt: new Date(),
    },
    create: {
      name: catalogue.dataSource.name,
      category: catalogue.dataSource.category,
      provenance: Provenance.VERIFIED,
      providerUrl: catalogue.dataSource.providerUrl,
      lastUpdatedAt: new Date(),
      isActive: true,
    },
  });

  // 2. Ensure all 4 PaintBrand records exist (Req 8.1, 8.6)
  const brands = [
    { name: 'Asian Paints', slug: 'asian-paints', isActive: true },
    { name: 'Berger Paints', slug: 'berger-paints', isActive: false },
    { name: 'Kansai Nerolac', slug: 'nerolac', isActive: false },
    { name: 'Birla Opus', slug: 'birla-opus', isActive: false },
  ];

  for (const b of brands) {
    await prisma.paintBrand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, isActive: b.isActive },
      create: { name: b.name, slug: b.slug, isActive: b.isActive },
    });
  }

  const activeBrand = await prisma.paintBrand.findUnique({
    where: { slug: catalogue.brand.slug },
  });

  if (!activeBrand) {
    throw new Error(`Brand ${catalogue.brand.slug} could not be resolved`);
  }

  // 3. Upsert Products
  const productMap = new Map<string, string>(); // name -> id
  for (const prod of catalogue.products) {
    const existing = await prisma.paintProduct.findFirst({
      where: { brandId: activeBrand.id, name: prod.name },
    });

    let productId: string;
    if (existing) {
      const updated = await prisma.paintProduct.update({
        where: { id: existing.id },
        data: {
          formulation: prod.formulation,
          finishType: prod.finishType,
          applicationScope: prod.applicationScope,
          surfaceCompatibility: JSON.stringify(prod.surfaceCompatibility),
          isActive: true,
        },
      });
      productId = updated.id;
    } else {
      const created = await prisma.paintProduct.create({
        data: {
          brandId: activeBrand.id,
          name: prod.name,
          formulation: prod.formulation,
          finishType: prod.finishType,
          applicationScope: prod.applicationScope,
          surfaceCompatibility: JSON.stringify(prod.surfaceCompatibility),
          isActive: true,
        },
      });
      productId = created.id;
    }
    productMap.set(prod.name, productId);
  }

  // 4. Upsert Shades & ShadeSources
  let importedShadeCount = 0;
  for (const shade of catalogue.shades) {
    const productId = productMap.get(shade.productName);
    if (!productId) {
      logger.warn({ shadeName: shade.shadeName, product: shade.productName }, '[CatalogueImporter] Unknown product for shade');
      continue;
    }

    const existingShade = await prisma.paintShade.findFirst({
      where: { productId, shadeCode: shade.shadeCode },
    });

    let shadeId: string;
    if (existingShade) {
      const updated = await prisma.paintShade.update({
        where: { id: existingShade.id },
        data: {
          shadeName: shade.shadeName,
          colourFamily: shade.colourFamily,
          hexApprox: shade.hexApprox,
          provenance: Provenance.VERIFIED,
          isActive: true,
        },
      });
      shadeId = updated.id;
    } else {
      const created = await prisma.paintShade.create({
        data: {
          productId,
          shadeName: shade.shadeName,
          shadeCode: shade.shadeCode,
          colourFamily: shade.colourFamily,
          hexApprox: shade.hexApprox,
          provenance: Provenance.VERIFIED,
          isActive: true,
        },
      });
      shadeId = created.id;
    }

    // Link ShadeSource to DataSource
    const existingSource = await prisma.paintShadeSource.findFirst({
      where: { shadeId, dataSourceId: dataSource.id },
    });

    if (!existingSource) {
      await prisma.paintShadeSource.create({
        data: {
          shadeId,
          dataSourceId: dataSource.id,
          approvedBy: 'SYSTEM_CATALOGUE_IMPORTER',
        },
      });
    }

    importedShadeCount++;
  }

  logger.info(
    {
      brand: activeBrand.name,
      products: catalogue.products.length,
      shades: importedShadeCount,
      dataSource: dataSource.name,
    },
    '[CatalogueImporter] Catalogue import completed successfully'
  );

  return {
    brandId: activeBrand.id,
    productsCount: catalogue.products.length,
    shadesCount: importedShadeCount,
  };
}

if (require.main === module) {
  importCatalogue()
    .then((res) => {
      console.log('Catalogue imported successfully:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Catalogue import failed:', err);
      process.exit(1);
    });
}
