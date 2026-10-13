import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { OpenMeteoClient } from '@/lib/climate/open-meteo';
import { RegionalAggregateClient } from '@/lib/climate/regional-fallback';
import { Provenance } from '@/types/enums';

export class ClimateUnavailableException extends Error {
  constructor(message = 'Climate data is unavailable for this location') {
    super(message);
    this.name = 'ClimateUnavailableException';
  }
}

export class ClimateService {
  /**
   * Fetches monthly climate data (via Open-Meteo with regional fallback) and persists ClimateProfile + 12 Observations
   */
  static async fetchAndPersistProfile(
    projectLocationId: string,
    latitude: number,
    longitude: number
  ) {
    let observations: any[] = [];
    let provenance: Provenance = Provenance.VERIFIED;
    let dataSourceName = 'Open-Meteo';

    try {
      logger.info({ projectLocationId, latitude, longitude }, '[ClimateService] Attempting Open-Meteo primary fetch');
      const primary = await OpenMeteoClient.fetchMonthlyClimate(latitude, longitude, 3);
      observations = primary.observations;
      provenance = Provenance.VERIFIED;
      dataSourceName = 'Open-Meteo';
    } catch (primaryErr) {
      logger.warn(
        { primaryErr, projectLocationId, latitude, longitude },
        '[ClimateService] Primary Open-Meteo fetch failed, engaging regional fallback'
      );

      try {
        const fallback = RegionalAggregateClient.getRegionalClimate(latitude, longitude);
        observations = fallback.observations;
        provenance = Provenance.DERIVED;
        dataSourceName = 'Regional Climate Fallback';
      } catch (fallbackErr) {
        logger.error(
          { fallbackErr, projectLocationId },
          '[ClimateService] Regional climate fallback also failed'
        );
        throw new ClimateUnavailableException();
      }
    }

    if (!observations || observations.length !== 12) {
      throw new ClimateUnavailableException('Incomplete climate observations collected');
    }

    // Ensure DataSource record exists
    const dataSource = await prisma.dataSource.upsert({
      where: { name: dataSourceName },
      update: {
        category: 'CLIMATE',
        provenance: provenance === Provenance.VERIFIED ? Provenance.VERIFIED : Provenance.DERIVED,
        lastUpdatedAt: new Date(),
      },
      create: {
        name: dataSourceName,
        category: 'CLIMATE',
        provenance: provenance === Provenance.VERIFIED ? Provenance.VERIFIED : Provenance.DERIVED,
        providerUrl: dataSourceName === 'Open-Meteo' ? 'https://open-meteo.com' : 'local://regional-fallback',
        isActive: true,
      },
    });

    // Check if ClimateProfile already exists for this ProjectLocation
    const existing = await prisma.climateProfile.findUnique({
      where: { projectLocationId },
    });

    if (existing) {
      // Delete old observations before inserting new ones
      await prisma.climateObservation.deleteMany({
        where: { climateProfileId: existing.id },
      });
    }

    const profile = await prisma.climateProfile.upsert({
      where: { projectLocationId },
      update: {
        provenance,
        dataSourceId: dataSource.id,
        retrievedAt: new Date(),
        observations: {
          create: observations.map((o) => ({
            month: o.month,
            avgTempCelsius: o.avgTempCelsius,
            avgHumidityPct: o.avgHumidityPct,
            totalRainfallMm: o.totalRainfallMm,
            avgUvIndex: o.avgUvIndex,
            avgWindSpeedKmh: o.avgWindSpeedKmh ?? null,
            prevailingWindDir: o.prevailingWindDir ?? null,
          })),
        },
      },
      create: {
        projectLocationId,
        provenance,
        dataSourceId: dataSource.id,
        retrievedAt: new Date(),
        observations: {
          create: observations.map((o) => ({
            month: o.month,
            avgTempCelsius: o.avgTempCelsius,
            avgHumidityPct: o.avgHumidityPct,
            totalRainfallMm: o.totalRainfallMm,
            avgUvIndex: o.avgUvIndex,
            avgWindSpeedKmh: o.avgWindSpeedKmh ?? null,
            prevailingWindDir: o.prevailingWindDir ?? null,
          })),
        },
      },
      include: {
        observations: {
          orderBy: { month: 'asc' },
        },
        dataSource: true,
      },
    });

    await recordAuditEvent({
      userId: null,
      eventType: 'CLIMATE_PROFILE_RETRIEVED',
      resourceType: 'ClimateProfile',
      resourceId: profile.id,
      outcome: 'SUCCESS',
      metadata: {
        projectLocationId,
        provenance,
        dataSourceName,
        observationsCount: profile.observations.length,
      },
    });

    return profile;
  }

  /**
   * Retrieves profile by ProjectLocation ID and attaches climateDataNote if provenance is DERIVED
   */
  static async getProfileByProjectLocationId(projectLocationId: string) {
    const profile = await prisma.climateProfile.findUnique({
      where: { projectLocationId },
      include: {
        observations: {
          orderBy: { month: 'asc' },
        },
        dataSource: true,
      },
    });

    if (!profile) {
      return null;
    }

    return {
      ...profile,
      climateDataNote:
        profile.provenance === Provenance.DERIVED
          ? 'Regional average climate data was used. Local conditions may vary.'
          : null,
    };
  }
}
