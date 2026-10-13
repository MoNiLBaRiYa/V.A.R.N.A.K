import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { GoogleGeocodingClient, GeocodingResult } from '@/lib/location/google-geocoding';
import { ProjectService } from '@/lib/projects/service';
import { ClimateService } from '@/lib/climate/service';
import { Provenance, ProjectStatus } from '@/types/enums';

export interface ConfirmLocationInput {
  rawInput: string;
  resolvedAddress: string;
  latitude: number;
  longitude: number;
}

export class GeocodingService {
  /**
   * Resolves address or PIN code to coordinates WITHOUT persisting
   */
  static async resolveLocation(rawInput: string): Promise<GeocodingResult> {
    return GoogleGeocodingClient.resolveAddress(rawInput);
  }

  /**
   * Confirms location and persists ProjectLocation, then triggers ClimateService fetch
   */
  static async confirmLocation(
    userId: string,
    projectId: string,
    input: ConfirmLocationInput
  ) {
    const project = await ProjectService.getProjectById(userId, projectId);

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new Error('Cannot set location on an archived project');
    }

    const location = await prisma.projectLocation.upsert({
      where: { projectId },
      update: {
        rawInput: input.rawInput,
        resolvedAddress: input.resolvedAddress,
        latitude: input.latitude,
        longitude: input.longitude,
        geocodingProvider: 'google-geocoding',
        inputProvenance: Provenance.USER_PROVIDED,
        coordinatesProvenance: Provenance.VERIFIED,
      },
      create: {
        projectId,
        rawInput: input.rawInput,
        resolvedAddress: input.resolvedAddress,
        latitude: input.latitude,
        longitude: input.longitude,
        geocodingProvider: 'google-geocoding',
        inputProvenance: Provenance.USER_PROVIDED,
        coordinatesProvenance: Provenance.VERIFIED,
      },
    });

    await recordAuditEvent({
      userId,
      eventType: 'LOCATION_CONFIRMED',
      resourceType: 'ProjectLocation',
      resourceId: location.id,
      outcome: 'SUCCESS',
      metadata: {
        projectId,
        resolvedAddress: input.resolvedAddress,
        latitude: input.latitude,
        longitude: input.longitude,
      },
    });

    // Trigger climate profile retrieval for the confirmed location
    try {
      await ClimateService.fetchAndPersistProfile(location.id, input.latitude, input.longitude);
    } catch (climateErr) {
      logger.error(
        { climateErr, projectId, locationId: location.id },
        '[GeocodingService] Climate profiling trigger failed'
      );
    }

    return prisma.projectLocation.findUnique({
      where: { id: location.id },
      include: {
        climateProfile: {
          include: { observations: true },
        },
      },
    });
  }
}
