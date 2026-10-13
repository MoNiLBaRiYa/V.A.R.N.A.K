import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClimateService, ClimateUnavailableException } from '@/lib/climate/service';
import { OpenMeteoClient } from '@/lib/climate/open-meteo';
import { RegionalAggregateClient } from '@/lib/climate/regional-fallback';
import { prisma } from '@/lib/db/prisma';
import * as auditModule from '@/lib/audit';
import { Provenance } from '@/types/enums';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    dataSource: {
      upsert: vi.fn(),
    },
    climateProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    climateObservation: {
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('Climate Profiling Engine & Regional Fallback (02-02 Task 2)', () => {
  const projectLocationId = 'loc-test-123';
  const lat = 12.9716;
  const lng = 77.5946;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Regional Fallback Climatology Dataset', () => {
    it('returns exactly 12 monthly observations for any Indian coordinates', () => {
      const fallback = RegionalAggregateClient.getRegionalClimate(lat, lng);

      expect(fallback.provenance).toBe('DERIVED');
      expect(fallback.observations).toHaveLength(12);
      fallback.observations.forEach((obs, index) => {
        expect(obs.month).toBe(index + 1);
        expect(typeof obs.avgTempCelsius).toBe('number');
        expect(typeof obs.avgHumidityPct).toBe('number');
        expect(typeof obs.totalRainfallMm).toBe('number');
        expect(typeof obs.avgUvIndex).toBe('number');
      });
    });

    it('matches desert coordinates (Jaipur) to HOT_AND_DRY climatic zone', () => {
      const fallback = RegionalAggregateClient.getRegionalClimate(26.9, 75.8);
      expect(fallback.zoneKey).toBe('HOT_AND_DRY');
    });

    it('matches coastal coordinates (Mumbai) to WARM_AND_HUMID climatic zone', () => {
      const fallback = RegionalAggregateClient.getRegionalClimate(18.9, 72.8);
      expect(fallback.zoneKey).toBe('WARM_AND_HUMID');
    });
  });

  describe('ClimateService Orchestration', () => {
    it('persists profile with VERIFIED provenance when Open-Meteo primary succeeds', async () => {
      const mockObservations = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        avgTempCelsius: 25 + i * 0.5,
        avgHumidityPct: 60 + i,
        totalRainfallMm: 10 + i * 5,
        avgUvIndex: 7.0,
      }));

      vi.spyOn(OpenMeteoClient, 'fetchMonthlyClimate').mockResolvedValue({
        observations: mockObservations,
        provenance: 'VERIFIED',
      });

      (prisma.dataSource.upsert as any).mockResolvedValue({
        id: 'ds-open-meteo',
        name: 'Open-Meteo',
      });

      (prisma.climateProfile.findUnique as any).mockResolvedValue(null);
      (prisma.climateProfile.upsert as any).mockResolvedValue({
        id: 'cp-verified-1',
        projectLocationId,
        provenance: Provenance.VERIFIED,
        observations: mockObservations,
      });

      const profile = await ClimateService.fetchAndPersistProfile(projectLocationId, lat, lng);

      expect(profile.provenance).toBe(Provenance.VERIFIED);
      expect(prisma.climateProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectLocationId },
          create: expect.objectContaining({
            provenance: Provenance.VERIFIED,
          }),
        })
      );
      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'CLIMATE_PROFILE_RETRIEVED',
          outcome: 'SUCCESS',
        })
      );
    });

    it('falls back to regional dataset and sets DERIVED provenance when Open-Meteo fails', async () => {
      vi.spyOn(OpenMeteoClient, 'fetchMonthlyClimate').mockRejectedValue(
        new Error('Network timeout / API unavailable')
      );

      (prisma.dataSource.upsert as any).mockResolvedValue({
        id: 'ds-fallback',
        name: 'Regional Climate Fallback',
      });

      (prisma.climateProfile.findUnique as any).mockResolvedValue(null);
      (prisma.climateProfile.upsert as any).mockResolvedValue({
        id: 'cp-derived-2',
        projectLocationId,
        provenance: Provenance.DERIVED,
        observations: Array.from({ length: 12 }, (_, i) => ({ month: i + 1 })),
      });

      const profile = await ClimateService.fetchAndPersistProfile(projectLocationId, lat, lng);

      expect(profile.provenance).toBe(Provenance.DERIVED);
      expect(prisma.climateProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectLocationId },
          create: expect.objectContaining({
            provenance: Provenance.DERIVED,
          }),
        })
      );
    });

    it('getProfileByProjectLocationId attaches climateDataNote when provenance is DERIVED', async () => {
      (prisma.climateProfile.findUnique as any).mockResolvedValue({
        id: 'cp-derived-2',
        projectLocationId,
        provenance: Provenance.DERIVED,
        observations: [{ month: 1, avgTempCelsius: 20 }],
        dataSource: { name: 'Regional Climate Fallback' },
      });

      const profile = await ClimateService.getProfileByProjectLocationId(projectLocationId);

      expect(profile?.climateDataNote).toBe(
        'Regional average climate data was used. Local conditions may vary.'
      );
    });

    it('getProfileByProjectLocationId has null climateDataNote when provenance is VERIFIED', async () => {
      (prisma.climateProfile.findUnique as any).mockResolvedValue({
        id: 'cp-verified-1',
        projectLocationId,
        provenance: Provenance.VERIFIED,
        observations: [{ month: 1, avgTempCelsius: 20 }],
        dataSource: { name: 'Open-Meteo' },
      });

      const profile = await ClimateService.getProfileByProjectLocationId(projectLocationId);

      expect(profile?.climateDataNote).toBeNull();
    });
  });
});
