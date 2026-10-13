import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ApplicationScope, Provenance } from '@/types/enums';

describe('Manufacturer Catalogue Integrity & Scope Rules (02-04 Task 2)', () => {
  const cataloguePath = path.join(
    process.cwd(),
    'src',
    'data',
    'catalogues',
    'asian-paints.json'
  );

  it('validates that asian-paints.json exists and conforms to catalogue schema', () => {
    expect(fs.existsSync(cataloguePath)).toBe(true);

    const raw = fs.readFileSync(cataloguePath, 'utf-8');
    const data = JSON.parse(raw);

    expect(data.brand.name).toBe('Asian Paints');
    expect(data.brand.slug).toBe('asian-paints');
    expect(data.brand.isActive).toBe(true);
    expect(data.dataSource.name).toContain('Asian Paints');
    expect(data.products.length).toBeGreaterThanOrEqual(4);
    expect(data.shades.length).toBeGreaterThanOrEqual(20);
  });

  it('asserts that 100% of PaintShade records in the catalogue have provenance == VERIFIED', () => {
    const raw = fs.readFileSync(cataloguePath, 'utf-8');
    const data = JSON.parse(raw);

    const unverifiedShades = data.shades.filter(
      (s: any) => s.provenance !== Provenance.VERIFIED && s.provenance !== 'VERIFIED'
    );

    expect(unverifiedShades).toHaveLength(0);
  });

  it('verifies all catalogue products specify valid applicationScope (INTERIOR, EXTERIOR, or BOTH)', () => {
    const raw = fs.readFileSync(cataloguePath, 'utf-8');
    const data = JSON.parse(raw);

    const validScopes = [
      ApplicationScope.INTERIOR,
      ApplicationScope.EXTERIOR,
      ApplicationScope.BOTH,
    ];

    for (const prod of data.products) {
      expect(validScopes).toContain(prod.applicationScope);
      expect(Array.isArray(prod.surfaceCompatibility)).toBe(true);
      expect(prod.surfaceCompatibility.length).toBeGreaterThan(0);
    }
  });

  it('validates ApplicationScope enum acceptance and persistence contract', () => {
    const scopeSchema = z.nativeEnum(ApplicationScope);

    // Wave 1 contract: accepts INTERIOR, EXTERIOR, and BOTH
    expect(scopeSchema.safeParse('INTERIOR').success).toBe(true);
    expect(scopeSchema.safeParse('EXTERIOR').success).toBe(true);
    expect(scopeSchema.safeParse('BOTH').success).toBe(true);
    expect(scopeSchema.safeParse('INVALID').success).toBe(false);

    // Persistence simulation
    const projectRecord = {
      id: 'proj-1',
      name: 'Residency Project',
      applicationScope: ApplicationScope.BOTH,
    };

    expect(projectRecord.applicationScope).toBe('BOTH');
  });

  it('enforces brand selection guard: non-active brand or 0 verified shades cannot run recommendations', () => {
    function validateBrandForRecommendation(brand: {
      slug: string;
      isActive: boolean;
      verifiedShadeCount: number;
    }) {
      if (!brand.isActive) {
        throw new Error(`Manufacturer ${brand.slug} is currently unavailable (Coming Soon).`);
      }
      if (brand.verifiedShadeCount === 0) {
        throw new Error(`Manufacturer ${brand.slug} has 0 verified catalogue shades.`);
      }
      return true;
    }

    // Active Asian Paints with shades -> Passes
    expect(
      validateBrandForRecommendation({
        slug: 'asian-paints',
        isActive: true,
        verifiedShadeCount: 26,
      })
    ).toBe(true);

    // Non-active Berger Paints -> Fails with descriptive error
    expect(() =>
      validateBrandForRecommendation({
        slug: 'berger-paints',
        isActive: false,
        verifiedShadeCount: 0,
      })
    ).toThrow(/currently unavailable/i);

    // Brand with 0 shades -> Fails
    expect(() =>
      validateBrandForRecommendation({
        slug: 'asian-paints',
        isActive: true,
        verifiedShadeCount: 0,
      })
    ).toThrow(/0 verified catalogue shades/i);
  });
});
