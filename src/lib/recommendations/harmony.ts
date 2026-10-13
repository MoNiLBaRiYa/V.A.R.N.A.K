export interface RankedCandidate {
  shadeId: string;
  shadeName: string;
  shadeCode: string;
  colourFamily: string;
  hexApprox: string;
  productName: string;
  finishType: string;
  surfaceScope: string;
  compositeScore: number;
  factorScores: Record<string, { score: number; weight: number; weightedScore: number }>;
  isHarmonyReplacement?: boolean;
  replacedCandidateId?: string | null;
}

/**
 * Palette Harmony Post-Scoring Diversity Rule (§REQ-09.6, REQ-09.7, Design §8.1)
 *
 * Checks if >= 4 of the top 5 candidates share the same colourFamily.
 * If concentrated, scans positions 6-15 for the highest-ranked candidate of an
 * alternative colour family and replaces position 5 of the concentrated family.
 *
 * Invariant: Does NOT alter factor scores or composite scores.
 */
export function applyPaletteHarmony(
  rankedCandidates: RankedCandidate[]
): {
  top5: RankedCandidate[];
  harmonyApplied: boolean;
} {
  if (rankedCandidates.length <= 5) {
    return {
      top5: rankedCandidates.slice(0, 5),
      harmonyApplied: false,
    };
  }

  const initialTop5 = rankedCandidates.slice(0, 5);

  // Count colour families in top 5
  const familyCounts: Record<string, number> = {};
  for (const c of initialTop5) {
    familyCounts[c.colourFamily] = (familyCounts[c.colourFamily] || 0) + 1;
  }

  // Find concentrated family (>= 4 of 5)
  let concentratedFamily: string | null = null;
  for (const [fam, count] of Object.entries(familyCounts)) {
    if (count >= 4) {
      concentratedFamily = fam;
      break;
    }
  }

  if (!concentratedFamily) {
    return {
      top5: initialTop5,
      harmonyApplied: false,
    };
  }

  // Scan positions 6-15 (indices 5 to 14) for alternative family
  const searchPool = rankedCandidates.slice(5, 15);
  const replacementCandidate = searchPool.find(
    (c) => c.colourFamily !== concentratedFamily
  );

  if (!replacementCandidate) {
    // No eligible candidate found in 6-15; preserve top 5 unchanged
    return {
      top5: initialTop5,
      harmonyApplied: false,
    };
  }

  // Find candidate to replace: lowest-ranked candidate in top 5 belonging to concentrated family (index 4)
  let replaceIdx = -1;
  for (let i = 4; i >= 0; i--) {
    if (initialTop5[i].colourFamily === concentratedFamily) {
      replaceIdx = i;
      break;
    }
  }

  if (replaceIdx === -1) {
    return {
      top5: initialTop5,
      harmonyApplied: false,
    };
  }

  const replacedTarget = initialTop5[replaceIdx];

  // Clone replacement candidate with harmony flags, preserving scores unchanged
  const markedReplacement: RankedCandidate = {
    ...replacementCandidate,
    isHarmonyReplacement: true,
    replacedCandidateId: replacedTarget.shadeId,
  };

  const newTop5 = [...initialTop5];
  newTop5.splice(replaceIdx, 1, markedReplacement);

  // Re-sort top 5 by compositeScore DESC, shadeId ASC
  newTop5.sort((a, b) => {
    if (b.compositeScore !== a.compositeScore) {
      return b.compositeScore - a.compositeScore;
    }
    return a.shadeId.localeCompare(b.shadeId);
  });

  return {
    top5: newTop5,
    harmonyApplied: true,
  };
}
