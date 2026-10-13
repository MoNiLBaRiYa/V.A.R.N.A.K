import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecommendationEngine } from '@/lib/recommendations/engine';
import { DealerDiscoveryService } from '@/lib/dealers/discovery-service';
import { prisma } from '@/lib/db/prisma';
import { ApplicationScope, Provenance, ScoringFactor } from '@/types/enums';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    scoringWeightVersion: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    paintBrand: {
      findUnique: vi.fn(),
    },
    recommendationRun: {
      create: vi.fn(),
    },
    recommendation: {
      create: vi.fn(),
    },
    recommendationFactor: {
      createMany: vi.fn(),
    },
    dealer: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    GOOGLE_PLACES_API_KEY: 'test-key',
  },
}));

describe('Wave 1 End-to-End Vertical Slice Integration Test (02-05 Task 2)', () => {
  const projectId = 'proj-e2e-slice-100';
  const brandSlug = 'asian-paints';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs complete vertical slice: project -> climate -> vision -> scope BOTH -> 5 recommendations with 9 factors -> dealer discovery', async () => {
    // 1. Mock Project with confirmed location, climate profile, and completed photo analysis
    (prisma.project.findUnique as any).mockResolvedValue({
      id: projectId,
      name: 'E2E Bangalore Villa',
      userId: 'user-e2e',
      location: {
        rawInput: 'Indiranagar, Bengaluru',
        resolvedAddress: 'Indiranagar, Bengaluru, Karnataka 560038',
        latitude: 12.9716,
        longitude: 77.5946,
        climateProfile: {
          id: 'climate-e2e',
          provenance: Provenance.VERIFIED,
          observations: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            avgTempCelsius: 26,
            avgHumidityPct: 65,
            totalRainfallMm: 80,
            avgUvIndex: 7.2,
          })),
        },
      },
      images: [
        {
          id: 'img-e2e',
          processingState: 'COMPLETED',
          analysisResult: {
            id: 'analysis-e2e',
            spaceType: 'LIVING_ROOM',
            isInterior: true,
            architecturalStyle: 'CONTEMPORARY',
            visibleSurfaces: JSON.stringify(['PLASTER', 'CONCRETE']),
            naturalLightQuality: 'HIGH',
            paintableRegions: JSON.stringify(['WALLS']),
            analysisState: 'USER_OVERRIDDEN',
          },
        },
      ],
    });

    // 2. Mock Active Scoring Weight Version v1.0.0
    (prisma.scoringWeightVersion.findFirst as any).mockResolvedValue({
      id: 'weight-v1',
      version: 'v1.0.0',
      weights: JSON.stringify({
        CLIMATE_SUITABILITY: 0.20,
        INTERIOR_EXTERIOR_COMPATIBILITY: 0.15,
        SURFACE_COMPATIBILITY: 0.15,
        PRODUCT_SUITABILITY: 0.10,
        ARCHITECTURAL_CHARACTERISTICS: 0.10,
        ROOM_TYPE: 0.10,
        NATURAL_LIGHT: 0.10,
        COLOUR_FAMILY_COMPATIBILITY: 0.05,
        USER_PREFERENCES: 0.05,
      }),
    });

    // 3. Mock Asian Paints Catalogue with products and verified shades
    const mockShades = [
      { id: 's1', shadeName: 'Brilliant White', shadeCode: '0912', colourFamily: 'WHITE_AND_OFF_WHITE', hexApprox: '#FAF9F6', provenance: Provenance.VERIFIED, isActive: true },
      { id: 's2', shadeName: 'Serene Blue', shadeCode: '7245', colourFamily: 'BLUE', hexApprox: '#A4C2D1', provenance: Provenance.VERIFIED, isActive: true },
      { id: 's3', shadeName: 'Olive Branch', shadeCode: '8411', colourFamily: 'GREEN', hexApprox: '#708238', provenance: Provenance.VERIFIED, isActive: true },
      { id: 's4', shadeName: 'Golden Sunlight', shadeCode: '7820', colourFamily: 'YELLOW', hexApprox: '#FFD700', provenance: Provenance.VERIFIED, isActive: true },
      { id: 's5', shadeName: 'Warm Coral', shadeCode: '8024', colourFamily: 'RED_AND_ORANGE', hexApprox: '#F88379', provenance: Provenance.VERIFIED, isActive: true },
      { id: 's6', shadeName: 'Raw Jute', shadeCode: '8520', colourFamily: 'EARTH_TONE', hexApprox: '#A89F91', provenance: Provenance.VERIFIED, isActive: true },
      { id: 's7', shadeName: 'Morning Frost', shadeCode: 'L152', colourFamily: 'WHITE_AND_OFF_WHITE', hexApprox: '#F3F4F6', provenance: Provenance.VERIFIED, isActive: true },
    ];

    (prisma.paintBrand.findUnique as any).mockResolvedValue({
      id: 'brand-ap-1',
      name: 'Asian Paints',
      slug: 'asian-paints',
      isActive: true,
      products: [
        {
          id: 'prod-ap-1',
          name: 'Royale Luxury Emulsion',
          applicationScope: 'BOTH',
          finishType: 'MATT',
          surfaceCompatibility: JSON.stringify(['PLASTER', 'CONCRETE', 'WALLS']),
          shades: mockShades,
        },
      ],
    });

    (prisma.recommendationRun.create as any).mockResolvedValue({
      id: 'rec-run-999',
    });

    (prisma.recommendation.create as any).mockImplementation(({ data }: any) => ({
      id: `rec-entry-${data.rank}`,
      ...data,
    }));

    (prisma.recommendationFactor.createMany as any).mockResolvedValue({ count: 9 });

    // 4. Execute recommendation engine for ApplicationScope.BOTH
    const result = await RecommendationEngine.execute({
      projectId,
      manufacturerSlug: brandSlug,
      applicationScope: ApplicationScope.BOTH,
    });

    // 5. Invariant assertion: exactly 5 recommendations in a single ranked list for ApplicationScope.BOTH in MVP
    expect(result.recommendations).toHaveLength(5);
    expect(result.runId).toBe('rec-run-999');

    // Verify 9 factor scores exist on each recommendation
    for (const rec of result.recommendations) {
      expect(Object.keys(rec.factorScores)).toHaveLength(9);
      expect(rec.factorScores[ScoringFactor.CLIMATE_SUITABILITY]).toBeDefined();
      expect(rec.factorScores[ScoringFactor.COLOUR_FAMILY_COMPATIBILITY]).toBeDefined();
      expect(rec.factorScores[ScoringFactor.USER_PREFERENCES].score).toBe(0.5); // baseline
    }

    // 6. Discover dealers around the project location
    (prisma.dealer.create as any).mockImplementation(({ data }: any) => ({
      id: 'dealer-ind-1',
      name: data.name,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      state: data.state,
    }));

    const dealers = await DealerDiscoveryService.discoverDealers(12.9716, 77.5946, brandSlug);
    expect(dealers.length).toBeGreaterThan(0);
    expect(dealers[0].state).toBe('THIRD_PARTY_DISCOVERED');
  });

  it('preserves architectural boundary: zero reference to Wave 3 generative visualization entities', () => {
    const engineCode = RecommendationEngine.execute.toString();
    expect(engineCode).not.toContain('ImageGenerationJob');
    expect(engineCode).not.toContain('visualization-queue');
    expect(engineCode).not.toContain('GeminiFallbackPrompt');
  });
});
