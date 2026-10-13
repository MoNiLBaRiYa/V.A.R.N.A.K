import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export interface GeocodingResult {
  rawInput: string;
  resolvedAddress: string;
  latitude: number;
  longitude: number;
  postalCode?: string;
  geocodingProvider: 'google-geocoding';
}

export class GeocodingError extends Error {
  constructor(message: string, public code = 'GEOCODING_ERROR') {
    super(message);
    this.name = 'GeocodingError';
  }
}

export class GoogleGeocodingClient {
  private static readonly BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

  static async resolveAddress(rawInput: string): Promise<GeocodingResult> {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      throw new GeocodingError('Location input cannot be empty', 'INVALID_INPUT');
    }

    const apiKey = env.GOOGLE_GEOCODING_API_KEY;
    if (!apiKey) {
      logger.warn('[GoogleGeocodingClient] GOOGLE_GEOCODING_API_KEY is not configured');
      throw new GeocodingError('Geocoding service configuration missing', 'CONFIGURATION_ERROR');
    }

    const url = new URL(this.BASE_URL);
    url.searchParams.set('address', trimmed);
    url.searchParams.set('key', apiKey);

    // Optional country bias for India if appropriate
    url.searchParams.set('components', 'country:IN');

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new GeocodingError(`Geocoding API HTTP error: ${response.status}`, 'HTTP_ERROR');
      }

      const data = await response.json();

      if (data.status === 'ZERO_RESULTS') {
        throw new GeocodingError(`No geographic coordinates found for: "${trimmed}"`, 'ZERO_RESULTS');
      }

      if (data.status !== 'OK') {
        throw new GeocodingError(
          data.error_message || `Geocoding failed with status: ${data.status}`,
          data.status
        );
      }

      const first = data.results[0];
      const latitude = first.geometry.location.lat;
      const longitude = first.geometry.location.lng;
      const resolvedAddress = first.formatted_address;

      const postalCodeComponent = first.address_components?.find((c: any) =>
        c.types?.includes('postal_code')
      );
      const postalCode = postalCodeComponent?.long_name;

      return {
        rawInput: trimmed,
        resolvedAddress,
        latitude,
        longitude,
        postalCode,
        geocodingProvider: 'google-geocoding',
      };
    } catch (error) {
      if (error instanceof GeocodingError) {
        throw error;
      }
      logger.error({ error, rawInput }, '[GoogleGeocodingClient] Unexpected network error');
      throw new GeocodingError('Failed to communicate with geocoding service', 'NETWORK_ERROR');
    }
  }
}
