import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export interface GeminiAnalysisOutput {
  spaceType: string;
  isInterior: boolean;
  facadeType?: string | null;
  floorCount?: number | null;
  architecturalStyle: string;
  visibleSurfaces: string[];
  naturalLightQuality: string;
  paintableRegions: string[];
  confidence: {
    spaceType: number;
    architecturalStyle: number;
    surfaces: number;
    overall: number;
  };
  rawJson: string;
}

export class GeminiSafetyRefusalError extends Error {
  constructor(message: string, public refusalReason: string) {
    super(message);
    this.name = 'GeminiSafetyRefusalError';
  }
}

export class GeminiRetryableError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'GeminiRetryableError';
  }
}

export class GeminiFatalError extends Error {
  constructor(message: string, public code = 'FATAL_GEMINI_ERROR') {
    super(message);
    this.name = 'GeminiFatalError';
  }
}

const ANALYSIS_PROMPT = `
You are an expert architectural paint and building inspector. Analyze this property photograph and extract structured visual features for architectural paint and surface recommendation.

Return a STRICT, RAW JSON object (no markdown fences, no explanatory text) conforming to the following structure:
{
  "spaceType": "LIVING_ROOM" | "BEDROOM" | "KITCHEN" | "BATHROOM" | "DINING" | "EXTERIOR_FACADE" | "BALCONY" | "HALLWAY" | "OFFICE" | "OTHER",
  "isInterior": boolean,
  "facadeType": string | null,
  "floorCount": number | null,
  "architecturalStyle": "MODERN" | "CONTEMPORARY" | "TRADITIONAL" | "COLONIAL" | "MINIMALIST" | "INDUSTRIAL" | "OTHER",
  "visibleSurfaces": string[], // e.g. ["PLASTER", "CONCRETE", "DRYWALL", "WOOD", "BRICK", "METAL", "STUCCO"]
  "naturalLightQuality": "HIGH" | "MEDIUM" | "LOW" | "DIRECT_SUNLIGHT",
  "paintableRegions": string[], // e.g. ["WALLS", "CEILING", "ACCENT_WALL", "TRIM", "DOORS", "EXTERIOR_WALLS"]
  "confidence": {
    "spaceType": number (0.0 to 1.0),
    "architecturalStyle": number (0.0 to 1.0),
    "surfaces": number (0.0 to 1.0),
    "overall": number (0.0 to 1.0)
  }
}
`;

export class GeminiAnalysisClient {
  private static getApiKey(): string {
    const key = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new GeminiFatalError('GEMINI_API_KEY is not configured in environment', 'MISSING_API_KEY');
    }
    return key;
  }

  private static getModel(): string {
    const model = env.IMAGE_ANALYSIS_MODEL || process.env.IMAGE_ANALYSIS_MODEL || 'gemini-1.5-pro';
    if (!model) {
      throw new GeminiFatalError('IMAGE_ANALYSIS_MODEL is not configured in environment', 'MISSING_MODEL');
    }
    return model;
  }

  static async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<GeminiAnalysisOutput> {
    const apiKey = this.getApiKey();
    const model = this.getModel();
    const base64Data = imageBuffer.toString('base64');

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: ANALYSIS_PROMPT },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (networkErr: any) {
      logger.warn({ networkErr }, '[GeminiAnalysisClient] Network fetch error, marking retryable');
      throw new GeminiRetryableError(`Network error communicating with Gemini API: ${networkErr.message}`, networkErr);
    }

    if (!response.ok) {
      const errorText = await response.text();
      // Quota / 429 / 503 / 500 are retryable
      if (response.status === 429 || response.status >= 500) {
        logger.warn({ status: response.status, errorText }, '[GeminiAnalysisClient] Retryable HTTP error from Gemini API');
        throw new GeminiRetryableError(`Gemini API returned retryable status ${response.status}`, { status: response.status, body: errorText });
      }

      logger.error({ status: response.status, errorText }, '[GeminiAnalysisClient] Non-retryable HTTP error from Gemini API');
      throw new GeminiFatalError(`Gemini API returned status ${response.status}: ${errorText}`, 'API_ERROR');
    }

    const data = await response.json();

    // Check prompt feedback for safety block
    if (data.promptFeedback?.blockReason) {
      const reason = data.promptFeedback.blockReason;
      logger.warn({ reason }, '[GeminiAnalysisClient] Prompt blocked by Gemini safety filters');
      throw new GeminiSafetyRefusalError(`Image prompt blocked by safety filter: ${reason}`, reason);
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new GeminiRetryableError('No response candidate returned by Gemini API');
    }

    // Check finish reason for SAFETY
    if (candidate.finishReason === 'SAFETY') {
      const reason = candidate.safetyRatings
        ? JSON.stringify(candidate.safetyRatings)
        : 'SAFETY_FILTER_TRIGGERED';
      logger.warn({ finishReason: candidate.finishReason, reason }, '[GeminiAnalysisClient] Image generation refused due to SAFETY');
      throw new GeminiSafetyRefusalError('Gemini vision analysis refused due to safety rating', reason);
    }

    const textPart = candidate.content?.parts?.[0]?.text;
    if (!textPart) {
      throw new GeminiRetryableError('Empty text part in Gemini API response');
    }

    try {
      // Clean up markdown wrapper if any
      const cleaned = textPart.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        spaceType: parsed.spaceType || 'LIVING_ROOM',
        isInterior: typeof parsed.isInterior === 'boolean' ? parsed.isInterior : true,
        facadeType: parsed.facadeType || null,
        floorCount: typeof parsed.floorCount === 'number' ? parsed.floorCount : null,
        architecturalStyle: parsed.architecturalStyle || 'CONTEMPORARY',
        visibleSurfaces: Array.isArray(parsed.visibleSurfaces) ? parsed.visibleSurfaces : ['PLASTER'],
        naturalLightQuality: parsed.naturalLightQuality || 'MEDIUM',
        paintableRegions: Array.isArray(parsed.paintableRegions) ? parsed.paintableRegions : ['WALLS'],
        confidence: parsed.confidence || {
          spaceType: 0.9,
          architecturalStyle: 0.85,
          surfaces: 0.88,
          overall: 0.88,
        },
        rawJson: cleaned,
      };
    } catch (parseErr: any) {
      logger.warn({ textPart, parseErr }, '[GeminiAnalysisClient] JSON parse failure, retryable');
      throw new GeminiRetryableError(`Failed to parse structured JSON from Gemini: ${parseErr.message}`, parseErr);
    }
  }
}
