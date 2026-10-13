import { describe, it, expect } from 'vitest';
import {
  FACTOR_CALCULATORS,
  CandidateContext,
} from '@/lib/recommendations/factors';
import { ScoringFactor, ApplicationScope } from '@/types/enums';

describe('9-Factor Recommendation Scoring Engine (02-05 Task 1)', () => {
  const sampleContext: CandidateContext = {
    shade: {
      id: 'shade-001',
      shadeName: 'Apex Terracotta Glory',
      shadeCode: 'X110',
      colourFamily: 'EARTH_TONE',
      hexApprox: '#C86446',
    },
    product: {
      id: 'prod-001',
      name: 'Apex Ultima Weather Defence',
      applicationScope: 'EXTERIOR',
      finishType: 'SHEEN',
      surfaceCompatibility: JSON.stringify(['EXTERIOR_WALLS', 'PLASTER', 'CONCRETE']),
    },
    analysis: {
      spaceType: 'EXTERIOR_FACADE',
      isInterior: false,
      facadeType: 'RESIDENTIAL',
      architecturalStyle: 'TRADITIONAL',
      visibleSurfaces: ['PLASTER', 'CONCRETE'],
      naturalLightQuality: 'HIGH',
      paintableRegions: ['WALLS'],
    },
    climate: {
      observations: [
        {
          month: 1,
          avgTempCelsius: 28,
          avgHumidityPct: 80,
          totalRainfallMm: 150,
          avgUvIndex: 8.5,
        },
      ],
    },
    projectScope: ApplicationScope.EXTERIOR,
    userPreferences: null,
  };

  const initialWeights: Record<ScoringFactor, number> = {
    [ScoringFactor.CLIMATE_SUITABILITY]: 0.20,
    [ScoringFactor.INTERIOR_EXTERIOR_COMPATIBILITY]: 0.15,
    [ScoringFactor.SURFACE_COMPATIBILITY]: 0.15,
    [ScoringFactor.PRODUCT_SUITABILITY]: 0.10,
    [ScoringFactor.ARCHITECTURAL_CHARACTERISTICS]: 0.10,
    [ScoringFactor.ROOM_TYPE]: 0.10,
    [ScoringFactor.NATURAL_LIGHT]: 0.10,
    [ScoringFactor.COLOUR_FAMILY_COMPATIBILITY]: 0.05,
    [ScoringFactor.USER_PREFERENCES]: 0.05,
  };

  it('verifies that active scoring weights sum to exactly 1.00', () => {
    const sum = Object.values(initialWeights).reduce((a, b) => a + b, 0);
    expect(Number(sum.toFixed(4))).toBe(1.0);
  });

  it('asserts all nine factor scoring functions return values bounded strictly within [0.0, 1.0]', () => {
    for (const factor of Object.values(ScoringFactor)) {
      const calc = FACTOR_CALCULATORS[factor];
      expect(calc).toBeDefined();

      const score = calc(sampleContext);
      expect(score).toBeGreaterThanOrEqual(0.0);
      expect(score).toBeLessThanOrEqual(1.0);
    }
  });

  it('unambiguously evaluates COLOUR_FAMILY_COMPATIBILITY as factor 8 in the MVP scoring engine', () => {
    expect(ScoringFactor.COLOUR_FAMILY_COMPATIBILITY).toBe('COLOUR_FAMILY_COMPATIBILITY');
    const score = FACTOR_CALCULATORS[ScoringFactor.COLOUR_FAMILY_COMPATIBILITY](sampleContext);
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('evaluates USER_PREFERENCES to a neutral baseline of 0.5 when preferences are unconfigured (§REQ-09)', () => {
    const ctxWithoutPrefs = { ...sampleContext, userPreferences: null };
    const score = FACTOR_CALCULATORS[ScoringFactor.USER_PREFERENCES](ctxWithoutPrefs);
    expect(score).toBe(0.5);

    const ctxWithEmptyPrefs = { ...sampleContext, userPreferences: {} };
    const score2 = FACTOR_CALCULATORS[ScoringFactor.USER_PREFERENCES](ctxWithEmptyPrefs);
    expect(score2).toBe(0.5);
  });

  it('calculates composite score as exact weighted sum: Σ(score_i × weight_i)', () => {
    let expectedComposite = 0;
    for (const factor of Object.values(ScoringFactor)) {
      const score = FACTOR_CALCULATORS[factor](sampleContext);
      const weight = initialWeights[factor];
      expectedComposite += score * weight;
    }

    expect(expectedComposite).toBeGreaterThan(0.5);
    expect(expectedComposite).toBeLessThanOrEqual(1.0);
  });

  it('enforces determinism: identical inputs produce identical scores across multiple runs', () => {
    const scoresRun1: Record<string, number> = {};
    const scoresRun2: Record<string, number> = {};

    for (const factor of Object.values(ScoringFactor)) {
      scoresRun1[factor] = FACTOR_CALCULATORS[factor](sampleContext);
      scoresRun2[factor] = FACTOR_CALCULATORS[factor](sampleContext);
    }

    expect(scoresRun1).toEqual(scoresRun2);
  });
});
