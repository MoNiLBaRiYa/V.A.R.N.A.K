import { describe, it, expect } from 'vitest';
import { applyPaletteHarmony, RankedCandidate } from '@/lib/recommendations/harmony';

describe('Palette Harmony Post-Scoring Diversity Rule (02-05 Task 1)', () => {
  const makeCandidate = (
    id: string,
    colourFamily: string,
    compositeScore: number
  ): RankedCandidate => ({
    shadeId: id,
    shadeName: `Shade ${id}`,
    shadeCode: `C-${id}`,
    colourFamily,
    hexApprox: '#123456',
    productName: 'Apex Ultima',
    finishType: 'SHEEN',
    surfaceScope: 'EXTERIOR',
    compositeScore,
    factorScores: {
      CLIMATE_SUITABILITY: { score: 0.9, weight: 0.2, weightedScore: 0.18 },
    },
  });

  it('leaves diverse top 5 unchanged when no colour family concentration exists (< 4 of 5)', () => {
    const candidates: RankedCandidate[] = [
      makeCandidate('1', 'BLUE', 0.95),
      makeCandidate('2', 'BLUE', 0.92),
      makeCandidate('3', 'GREEN', 0.90),
      makeCandidate('4', 'WHITE_AND_OFF_WHITE', 0.88),
      makeCandidate('5', 'EARTH_TONE', 0.85),
      makeCandidate('6', 'YELLOW', 0.82),
    ];

    const result = applyPaletteHarmony(candidates);
    expect(result.harmonyApplied).toBe(false);
    expect(result.top5.map((c) => c.shadeId)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('triggers replacement of position 5 when 4 of 5 top candidates share the same colour family', () => {
    // 4 BLUE candidates in top 5, 1 WHITE
    const candidates: RankedCandidate[] = [
      makeCandidate('1', 'BLUE', 0.95),
      makeCandidate('2', 'BLUE', 0.92),
      makeCandidate('3', 'BLUE', 0.90),
      makeCandidate('4', 'BLUE', 0.88),
      makeCandidate('5', 'WHITE_AND_OFF_WHITE', 0.85),
      makeCandidate('6', 'BLUE', 0.84),
      makeCandidate('7', 'EARTH_TONE', 0.82), // First alternative in positions 6-15!
      makeCandidate('8', 'GREEN', 0.80),
    ];

    const result = applyPaletteHarmony(candidates);
    expect(result.harmonyApplied).toBe(true);

    // Assert alternative candidate '7' entered the top 5
    const shadeIds = result.top5.map((c) => c.shadeId);
    expect(shadeIds).toContain('7');

    // Assert position 4 (the 4th BLUE candidate) was replaced, not WHITE
    const replacement = result.top5.find((c) => c.shadeId === '7');
    expect(replacement?.isHarmonyReplacement).toBe(true);
    expect(replacement?.replacedCandidateId).toBe('4');

    // Exactly 5 candidates returned
    expect(result.top5).toHaveLength(5);
  });

  it('invariant: does NOT modify any factor scores or composite scores during replacement', () => {
    const candidates: RankedCandidate[] = [
      makeCandidate('1', 'BLUE', 0.95),
      makeCandidate('2', 'BLUE', 0.92),
      makeCandidate('3', 'BLUE', 0.90),
      makeCandidate('4', 'BLUE', 0.88),
      makeCandidate('5', 'WHITE_AND_OFF_WHITE', 0.85),
      makeCandidate('6', 'GREEN', 0.82),
    ];

    const originalScore = candidates[5].compositeScore;
    const originalFactorScores = { ...candidates[5].factorScores };

    const result = applyPaletteHarmony(candidates);
    const replaced = result.top5.find((c) => c.shadeId === '6');

    expect(replaced?.compositeScore).toBe(originalScore);
    expect(replaced?.factorScores).toEqual(originalFactorScores);
  });

  it('leaves top 5 unchanged if no alternative family candidate exists in positions 6 to 15', () => {
    // All candidates in 6-15 are also BLUE
    const candidates: RankedCandidate[] = [
      makeCandidate('1', 'BLUE', 0.95),
      makeCandidate('2', 'BLUE', 0.92),
      makeCandidate('3', 'BLUE', 0.90),
      makeCandidate('4', 'BLUE', 0.88),
      makeCandidate('5', 'WHITE_AND_OFF_WHITE', 0.85),
      makeCandidate('6', 'BLUE', 0.82),
      makeCandidate('7', 'BLUE', 0.80),
    ];

    const result = applyPaletteHarmony(candidates);
    expect(result.harmonyApplied).toBe(false);
    expect(result.top5.map((c) => c.shadeId)).toEqual(['1', '2', '3', '4', '5']);
  });
});
