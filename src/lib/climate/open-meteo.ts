import { logger } from '@/lib/logger';
import { ClimateObservationInput } from '@/lib/climate/regional-fallback';

export class OpenMeteoClient {
  private static readonly BASE_URL = 'https://archive-api.open-meteo.com/v1/archive';

  /**
   * Fetches monthly historical climate data for coordinates from Open-Meteo API
   */
  static async fetchMonthlyClimate(
    lat: number,
    lng: number,
    retries = 3
  ): Promise<{ observations: ClimateObservationInput[]; provenance: 'VERIFIED' }> {
    let attempt = 0;
    let delay = 500;

    // Use full previous calendar year for complete 12-month climate averages
    const currentYear = new Date().getFullYear();
    const queryYear = currentYear - 1;
    const startDate = `${queryYear}-01-01`;
    const endDate = `${queryYear}-12-31`;

    const url = new URL(this.BASE_URL);
    url.searchParams.set('latitude', lat.toString());
    url.searchParams.set('longitude', lng.toString());
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    url.searchParams.set(
      'daily',
      'temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum,uv_index_max,wind_speed_10m_max'
    );
    url.searchParams.set('timezone', 'Asia/Kolkata');

    while (attempt < retries) {
      try {
        attempt++;
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Open-Meteo API HTTP error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.daily || !data.daily.time) {
          throw new Error('Malformed Open-Meteo response: daily time array missing');
        }

        const daily = data.daily;
        // Group by month (1..12) and compute averages
        const monthlyBuckets: {
          [month: number]: {
            temps: number[];
            humidities: number[];
            rainfalls: number[];
            uvs: number[];
            winds: number[];
          };
        } = {};

        for (let m = 1; m <= 12; m++) {
          monthlyBuckets[m] = { temps: [], humidities: [], rainfalls: [], uvs: [], winds: [] };
        }

        for (let i = 0; i < daily.time.length; i++) {
          const dateStr = daily.time[i]; // YYYY-MM-DD
          const month = parseInt(dateStr.split('-')[1], 10);
          if (month >= 1 && month <= 12) {
            if (daily.temperature_2m_mean?.[i] != null) {
              monthlyBuckets[month].temps.push(daily.temperature_2m_mean[i]);
            }
            if (daily.relative_humidity_2m_mean?.[i] != null) {
              monthlyBuckets[month].humidities.push(daily.relative_humidity_2m_mean[i]);
            }
            if (daily.precipitation_sum?.[i] != null) {
              monthlyBuckets[month].rainfalls.push(daily.precipitation_sum[i]);
            }
            if (daily.uv_index_max?.[i] != null) {
              monthlyBuckets[month].uvs.push(daily.uv_index_max[i]);
            }
            if (daily.wind_speed_10m_max?.[i] != null) {
              monthlyBuckets[month].winds.push(daily.wind_speed_10m_max[i]);
            }
          }
        }

        const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
        const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

        const observations: ClimateObservationInput[] = [];

        for (let m = 1; m <= 12; m++) {
          const b = monthlyBuckets[m];
          observations.push({
            month: m,
            avgTempCelsius: Math.round(avg(b.temps) * 10) / 10,
            avgHumidityPct: Math.round(avg(b.humidities) * 10) / 10,
            totalRainfallMm: Math.round(sum(b.rainfalls) * 10) / 10,
            avgUvIndex: Math.round(avg(b.uvs) * 10) / 10,
            avgWindSpeedKmh: Math.round(avg(b.winds) * 10) / 10,
          });
        }

        return {
          observations,
          provenance: 'VERIFIED',
        };
      } catch (err) {
        logger.warn(
          { attempt, retries, lat, lng, err: err instanceof Error ? err.message : err },
          '[OpenMeteoClient] Attempt failed'
        );
        if (attempt >= retries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    throw new Error('Open-Meteo retry budget exhausted');
  }
}
