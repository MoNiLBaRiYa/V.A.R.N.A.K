import { ScoringFactor, ApplicationScope } from '@/types/enums';

export interface CandidateContext {
  shade: {
    id: string;
    shadeName: string;
    shadeCode: string;
    colourFamily: string;
    hexApprox: string;
  };
  product: {
    id: string;
    name: string;
    applicationScope: string;
    finishType?: string | null;
    surfaceCompatibility?: string | null; // JSON array
  };
  analysis: {
    spaceType?: string | null;
    isInterior?: boolean | null;
    facadeType?: string | null;
    architecturalStyle?: string | null;
    visibleSurfaces?: string[] | null;
    naturalLightQuality?: string | null;
    paintableRegions?: string[] | null;
  };
  climate?: {
    annualFreezeThawayCycles?: number | null;
    observations?: Array<{
      month: number;
      avgTempCelsius: number;
      avgHumidityPct: number;
      totalRainfallMm: number;
      avgUvIndex: number;
      avgWindSpeedKmh?: number | null;
    }> | null;
  } | null;
  projectScope: ApplicationScope;
  userPreferences?: Record<string, any> | null;
}

/**
 * 1. CLIMATE_SUITABILITY (Factor 1)
 * Evaluates UV, precipitation, humidity, and thermal resilience against finish and formulation.
 */
export function calculateClimateSuitability(ctx: CandidateContext): number {
  if (!ctx.climate?.observations || ctx.climate.observations.length === 0) {
    return 0.7; // default baseline if observations minimal
  }

  const observations = ctx.climate.observations;
  const avgUv = observations.reduce((acc, o) => acc + o.avgUvIndex, 0) / observations.length;
  const totalRain = observations.reduce((acc, o) => acc + o.totalRainfallMm, 0);
  const avgHumidity = observations.reduce((acc, o) => acc + o.avgHumidityPct, 0) / observations.length;

  let score = 0.85;

  const isExteriorOrBoth =
    ctx.product.applicationScope === ApplicationScope.EXTERIOR ||
    ctx.product.applicationScope === ApplicationScope.BOTH;

  // Exterior coatings in high UV / rain areas require weather-shielding formulations
  if (isExteriorOrBoth) {
    if (avgUv > 7.0) {
      // Sheen/silicon exterior finishes withstand intense radiation better
      score += ctx.product.finishType === 'SHEEN' ? 0.1 : 0.02;
    }
    if (totalRain > 1200 || avgHumidity > 75) {
      // High precipitation favours anti-fungal elastomeric coatings
      score += ctx.product.name.toLowerCase().includes('ultima') ||
               ctx.product.name.toLowerCase().includes('damp sheath')
        ? 0.1
        : -0.05;
    }
  } else {
    // Interior: high humidity areas benefit from moisture-resistant formulations
    if (avgHumidity > 70) {
      score += ctx.product.name.toLowerCase().includes('royale') ? 0.08 : 0.0;
    }
  }

  return Math.min(1.0, Math.max(0.1, Number(score.toFixed(2))));
}

/**
 * 2. INTERIOR_EXTERIOR_COMPATIBILITY (Factor 2)
 * Matches product application scope to requested project scope.
 */
export function calculateScopeCompatibility(ctx: CandidateContext): number {
  const prodScope = ctx.product.applicationScope;
  const reqScope = ctx.projectScope;

  if (reqScope === ApplicationScope.BOTH) {
    if (prodScope === ApplicationScope.BOTH) return 1.0;
    if (prodScope === ApplicationScope.INTERIOR || prodScope === ApplicationScope.EXTERIOR) return 0.85;
  }

  if (reqScope === ApplicationScope.INTERIOR) {
    if (prodScope === ApplicationScope.INTERIOR || prodScope === ApplicationScope.BOTH) return 1.0;
    return 0.1;
  }

  if (reqScope === ApplicationScope.EXTERIOR) {
    if (prodScope === ApplicationScope.EXTERIOR || prodScope === ApplicationScope.BOTH) return 1.0;
    return 0.1;
  }

  return 0.5;
}

/**
 * 3. SURFACE_COMPATIBILITY (Factor 3)
 * Measures overlap between product-approved surfaces and detected visible surfaces.
 */
export function calculateSurfaceCompatibility(ctx: CandidateContext): number {
  if (!ctx.analysis.visibleSurfaces || ctx.analysis.visibleSurfaces.length === 0) {
    return 0.8;
  }

  let approvedSurfaces: string[] = [];
  try {
    approvedSurfaces = ctx.product.surfaceCompatibility
      ? JSON.parse(ctx.product.surfaceCompatibility)
      : [];
  } catch {
    approvedSurfaces = [];
  }

  if (approvedSurfaces.length === 0) return 0.75;

  const detected = ctx.analysis.visibleSurfaces.map((s) => s.toUpperCase());
  const approved = approvedSurfaces.map((s) => s.toUpperCase());

  const matched = detected.filter((d) => approved.includes(d));
  if (matched.length === 0) return 0.2;

  const ratio = matched.length / detected.length;
  return Math.min(1.0, Math.max(0.4, Number((0.6 + 0.4 * ratio).toFixed(2))));
}

/**
 * 4. PRODUCT_SUITABILITY (Factor 4)
 * Assesses product category alignment with space type and architectural needs.
 */
export function calculateProductSuitability(ctx: CandidateContext): number {
  const name = ctx.product.name.toLowerCase();
  const space = (ctx.analysis.spaceType || '').toUpperCase();

  let score = 0.8;
  if (space === 'LIVING_ROOM' || space === 'BEDROOM') {
    if (name.includes('royale')) score = 0.95;
    else if (name.includes('tractor')) score = 0.85;
  } else if (space === 'EXTERIOR_FACADE' || space === 'BALCONY') {
    if (name.includes('ultima')) score = 0.98;
    else if (name.includes('damp sheath')) score = 0.92;
  }

  return Math.min(1.0, Math.max(0.2, score));
}

/**
 * 5. ARCHITECTURAL_CHARACTERISTICS (Factor 5)
 * Harmonic alignment between shade colour family and architectural style.
 */
export function calculateArchitecturalCharacteristics(ctx: CandidateContext): number {
  const style = (ctx.analysis.architecturalStyle || 'CONTEMPORARY').toUpperCase();
  const family = ctx.shade.colourFamily.toUpperCase();

  const SYNERGY_MAP: Record<string, string[]> = {
    MODERN: ['WHITE_AND_OFF_WHITE', 'NEUTRAL_AND_GREY', 'BLUE'],
    MINIMALIST: ['WHITE_AND_OFF_WHITE', 'NEUTRAL_AND_GREY'],
    TRADITIONAL: ['EARTH_TONE', 'YELLOW', 'RED_AND_ORANGE', 'GREEN'],
    COLONIAL: ['WHITE_AND_OFF_WHITE', 'EARTH_TONE', 'GREEN'],
    INDUSTRIAL: ['NEUTRAL_AND_GREY', 'EARTH_TONE', 'BLUE'],
    CONTEMPORARY: ['WHITE_AND_OFF_WHITE', 'BLUE', 'GREEN', 'NEUTRAL_AND_GREY', 'EARTH_TONE'],
  };

  const preferred = SYNERGY_MAP[style] || SYNERGY_MAP.CONTEMPORARY;
  if (preferred.includes(family)) {
    return 0.95;
  }
  return 0.65;
}

/**
 * 6. ROOM_TYPE (Factor 6)
 * Finish suitability for the room's utility.
 */
export function calculateRoomTypeSuitability(ctx: CandidateContext): number {
  const space = (ctx.analysis.spaceType || '').toUpperCase();
  const finish = (ctx.product.finishType || 'MATT').toUpperCase();

  if (space === 'KITCHEN' || space === 'BATHROOM' || space === 'HALLWAY') {
    // High-traffic / washable areas prefer sheen or satin
    return finish === 'SHEEN' ? 0.95 : 0.75;
  }
  if (space === 'LIVING_ROOM' || space === 'BEDROOM') {
    // Bedrooms prefer luxurious matt or low-sheen
    return finish === 'MATT' ? 0.95 : 0.85;
  }
  return 0.8;
}

/**
 * 7. NATURAL_LIGHT (Factor 7)
 * Light reflectance suitability: low light requires higher reflectance; high light resists glare.
 */
export function calculateNaturalLightSuitability(ctx: CandidateContext): number {
  const light = (ctx.analysis.naturalLightQuality || 'MEDIUM').toUpperCase();
  const family = ctx.shade.colourFamily.toUpperCase();

  if (light === 'LOW') {
    // Low light needs off-whites or light pastels to bounce illumination
    if (family === 'WHITE_AND_OFF_WHITE' || family === 'YELLOW') return 0.95;
    if (family === 'NEUTRAL_AND_GREY' || family === 'EARTH_TONE') return 0.7;
    return 0.6;
  }

  if (light === 'HIGH' || light === 'DIRECT_SUNLIGHT') {
    // High light handles richer, saturated tones without looking dark
    if (family === 'BLUE' || family === 'GREEN' || family === 'EARTH_TONE') return 0.95;
    if (family === 'WHITE_AND_OFF_WHITE') return 0.8; // potential glare
    return 0.85;
  }

  // MEDIUM light
  return 0.88;
}

/**
 * 8. COLOUR_FAMILY_COMPATIBILITY (Factor 8)
 * Evaluates palette synergy and chromatic balance. Unambiguously in MVP.
 */
export function calculateColourFamilyCompatibility(ctx: CandidateContext): number {
  const family = ctx.shade.colourFamily.toUpperCase();
  // Universally versatile base families
  if (family === 'WHITE_AND_OFF_WHITE' || family === 'NEUTRAL_AND_GREY') {
    return 0.95;
  }
  return 0.85;
}

/**
 * 9. USER_PREFERENCES (Factor 9)
 * Returns neutral baseline 0.5 when explicit preferences are unconfigured (§REQ-09).
 */
export function calculateUserPreferences(ctx: CandidateContext): number {
  if (!ctx.userPreferences || Object.keys(ctx.userPreferences).length === 0) {
    return 0.5; // strict MVP neutral baseline
  }
  return 0.5;
}

export const FACTOR_CALCULATORS: Record<
  ScoringFactor,
  (ctx: CandidateContext) => number
> = {
  [ScoringFactor.CLIMATE_SUITABILITY]: calculateClimateSuitability,
  [ScoringFactor.INTERIOR_EXTERIOR_COMPATIBILITY]: calculateScopeCompatibility,
  [ScoringFactor.SURFACE_COMPATIBILITY]: calculateSurfaceCompatibility,
  [ScoringFactor.PRODUCT_SUITABILITY]: calculateProductSuitability,
  [ScoringFactor.ARCHITECTURAL_CHARACTERISTICS]: calculateArchitecturalCharacteristics,
  [ScoringFactor.ROOM_TYPE]: calculateRoomTypeSuitability,
  [ScoringFactor.NATURAL_LIGHT]: calculateNaturalLightSuitability,
  [ScoringFactor.COLOUR_FAMILY_COMPATIBILITY]: calculateColourFamilyCompatibility,
  [ScoringFactor.USER_PREFERENCES]: calculateUserPreferences,
};
