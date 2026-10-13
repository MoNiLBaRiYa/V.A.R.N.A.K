import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleGeocodingClient, GeocodingError } from '@/lib/location/google-geocoding';
import { GeocodingService } from '@/lib/location/service';
import { prisma } from '@/lib/db/prisma';
import * as auditModule from '@/lib/audit';
import { ProjectService } from '@/lib/projects/service';
import { ClimateService } from '@/lib/climate/service';
import { Provenance, ProjectStatus } from '@/types/enums';

vi.mock('@/lib/env', () => ({
  env: {
    GOOGLE_GEOCODING_API_KEY: 'test-google-api-key',
  },
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    projectLocation: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock('@/lib/projects/service', () => ({
  ProjectService: {
    getProjectById: vi.fn(),
  },
}));

vi.mock('@/lib/climate/service', () => ({
  ClimateService: {
    fetchAndPersistProfile: vi.fn(),
  },
}));

describe('Geocoding Service & Confirmation Workflow (02-02 Task 1)', () => {
  const userId = 'user-owner-123';
  const projectId = 'proj-loc-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GoogleGeocodingClient', () => {
    it('throws error when location input is empty or whitespace', async () => {
      await expect(GoogleGeocodingClient.resolveAddress('   ')).rejects.toThrow(
        /cannot be empty/i
      );
    });

    it('resolves address and PIN code to coordinates accurately', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [
            {
              formatted_address: 'Indiranagar, Bengaluru, Karnataka 560038, India',
              geometry: { location: { lat: 12.9716, lng: 77.5946 } },
              address_components: [
                { long_name: '560038', types: ['postal_code'] },
              ],
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      const result = await GoogleGeocodingClient.resolveAddress('560038');

      expect(result.resolvedAddress).toContain('Indiranagar');
      expect(result.latitude).toBe(12.9716);
      expect(result.longitude).toBe(77.5946);
      expect(result.postalCode).toBe('560038');
      expect(result.geocodingProvider).toBe('google-geocoding');
    });

    it('throws ZERO_RESULTS GeocodingError when location is unknown', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ZERO_RESULTS',
          results: [],
        }),
      });
      global.fetch = mockFetch;

      await expect(GoogleGeocodingClient.resolveAddress('nonexistentplaceXYZ12345')).rejects.toThrow(
        /No geographic coordinates found/i
      );
    });
  });

  describe('Two-Step Confirmation Flow & Invariant', () => {
    it('resolveLocation returns candidate without saving to database (Step 1)', async () => {
      vi.spyOn(GoogleGeocodingClient, 'resolveAddress').mockResolvedValue({
        rawInput: 'Koramangala, Bengaluru',
        resolvedAddress: 'Koramangala, Bengaluru, Karnataka, India',
        latitude: 12.9352,
        longitude: 77.6245,
        geocodingProvider: 'google-geocoding',
      });

      const result = await GeocodingService.resolveLocation('Koramangala, Bengaluru');

      expect(result.resolvedAddress).toBe('Koramangala, Bengaluru, Karnataka, India');
      // Assert DB upsert was NOT called
      expect(prisma.projectLocation.upsert).not.toHaveBeenCalled();
    });

    it('confirmLocation persists ProjectLocation with USER_PROVIDED and VERIFIED provenance (Step 2)', async () => {
      (ProjectService.getProjectById as any).mockResolvedValue({
        id: projectId,
        userId,
        status: ProjectStatus.ACTIVE,
      });

      (prisma.projectLocation.upsert as any).mockResolvedValue({
        id: 'loc-111',
        projectId,
        rawInput: 'Koramangala, Bengaluru',
        resolvedAddress: 'Koramangala, Bengaluru, Karnataka, India',
        latitude: 12.9352,
        longitude: 77.6245,
        inputProvenance: Provenance.USER_PROVIDED,
        coordinatesProvenance: Provenance.VERIFIED,
      });

      (prisma.projectLocation.findUnique as any).mockResolvedValue({
        id: 'loc-111',
        projectId,
        rawInput: 'Koramangala, Bengaluru',
        resolvedAddress: 'Koramangala, Bengaluru, Karnataka, India',
        latitude: 12.9352,
        longitude: 77.6245,
        climateProfile: null,
      });

      await GeocodingService.confirmLocation(userId, projectId, {
        rawInput: 'Koramangala, Bengaluru',
        resolvedAddress: 'Koramangala, Bengaluru, Karnataka, India',
        latitude: 12.9352,
        longitude: 77.6245,
      });

      expect(prisma.projectLocation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId },
          create: expect.objectContaining({
            inputProvenance: Provenance.USER_PROVIDED,
            coordinatesProvenance: Provenance.VERIFIED,
          }),
        })
      );

      expect(auditModule.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          eventType: 'LOCATION_CONFIRMED',
          outcome: 'SUCCESS',
        })
      );

      // Verify climate profile fetch triggered
      expect(ClimateService.fetchAndPersistProfile).toHaveBeenCalledWith(
        'loc-111',
        12.9352,
        77.6245
      );
    });

    it('rejects location confirmation on ARCHIVED projects', async () => {
      (ProjectService.getProjectById as any).mockResolvedValue({
        id: projectId,
        userId,
        status: ProjectStatus.ARCHIVED,
      });

      await expect(
        GeocodingService.confirmLocation(userId, projectId, {
          rawInput: 'Test',
          resolvedAddress: 'Test Address',
          latitude: 12.0,
          longitude: 77.0,
        })
      ).rejects.toThrow(/Cannot set location on an archived project/i);

      expect(prisma.projectLocation.upsert).not.toHaveBeenCalled();
    });
  });
});
