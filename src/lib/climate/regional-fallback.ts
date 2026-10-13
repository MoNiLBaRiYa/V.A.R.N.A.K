import regionalData from '@/data/regional-climate.json';
import { logger } from '@/lib/logger';

export interface ClimateObservationInput {
  month: number;
  avgTempCelsius: number;
  avgHumidityPct: number;
  totalRainfallMm: number;
  avgUvIndex: number;
  avgWindSpeedKmh?: number | null;
  prevailingWindDir?: string | null;
}

export interface RegionalFallbackResult {
  zoneKey: string;
  zoneName: string;
  observations: ClimateObservationInput[];
  provenance: 'DERIVED';
}

export class RegionalAggregateClient {
  /**
   * Matches latitude and longitude against Indian climatic zones based on nearest centroid
   */
  static getRegionalClimate(lat: number, lng: number): RegionalFallbackResult {
    let bestZoneKey = 'COMPOSITE';
    let minDistance = Infinity;

    const zones = (regionalData as any).zones;

    for (const [key, zone] of Object.entries<any>(zones)) {
      const rep = zone.representativeCoords;
      // Simple Euclidean distance approximation
      const dist = Math.sqrt(Math.pow(lat - rep.lat, 2) + Math.pow(lng - rep.lng, 2));
      if (dist < minDistance) {
        minDistance = dist;
        bestZoneKey = key;
      }
    }

    const matchedZone = zones[bestZoneKey];
    logger.info(
      { lat, lng, matchedZone: bestZoneKey },
      '[RegionalAggregateClient] Resolved regional climate fallback'
    );

    return {
      zoneKey: bestZoneKey,
      zoneName: matchedZone.name,
      observations: matchedZone.observations,
      provenance: 'DERIVED',
    };
  }
}
