import { RankedCandidate } from './harmony';

export function generateExplanation(
  candidate: RankedCandidate,
  context: {
    spaceType?: string | null;
    architecturalStyle?: string | null;
    naturalLightQuality?: string | null;
  }
): string {
  const factors = candidate.factorScores;
  const climateScore = factors.CLIMATE_SUITABILITY?.score ?? 0.8;
  const surfaceScore = factors.SURFACE_COMPATIBILITY?.score ?? 0.8;
  const styleScore = factors.ARCHITECTURAL_CHARACTERISTICS?.score ?? 0.8;

  const points: string[] = [];

  if (climateScore >= 0.85) {
    points.push('optimized for regional weather resilience and UV radiation');
  }

  if (surfaceScore >= 0.85) {
    points.push('high adhesion and durability for detected visible surfaces');
  }

  if (styleScore >= 0.85 && context.architecturalStyle) {
    points.push(`harmonic synergy with ${context.architecturalStyle.toLowerCase()} architecture`);
  }

  if (candidate.isHarmonyReplacement) {
    points.push('selected by Palette Harmony to ensure aesthetic palette diversity');
  }

  if (points.length === 0) {
    return `${candidate.shadeName} (${candidate.shadeCode}) by ${candidate.productName} is an ideal balance of durability and aesthetic radiance.`;
  }

  return `${candidate.shadeName} (${candidate.shadeCode}) recommended for its ${points.join(', ')}.`;
}
