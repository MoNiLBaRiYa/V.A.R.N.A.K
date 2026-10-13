export interface RelaxationResult<T> {
  eligibleCandidates: T[];
  relaxationStepsApplied: string[];
  insufficientCandidatesReason?: string | null;
}

export const RELAXATION_SEQUENCE = [
  'COLOUR_FAMILY_COMPATIBILITY',
  'NATURAL_LIGHT',
  'ROOM_TYPE',
  'ARCHITECTURAL_CHARACTERISTICS',
] as const;

/**
 * Filter Relaxation Algorithm (§REQ-09.8, REQ-09.9, Design §9)
 *
 * Progressively relaxes strict filter thresholds in designated order
 * until at least 5 candidates qualify, or sequence is exhausted.
 */
export function applyFilterRelaxation<T>(
  allCandidates: T[],
  filterWithExclusions: (candidate: T, relaxedFactors: string[]) => boolean
): RelaxationResult<T> {
  const relaxedFactors: string[] = [];

  // Initial check without any relaxation
  let currentEligible = allCandidates.filter((c) =>
    filterWithExclusions(c, relaxedFactors)
  );

  if (currentEligible.length >= 5) {
    return {
      eligibleCandidates: currentEligible,
      relaxationStepsApplied: [],
      insufficientCandidatesReason: null,
    };
  }

  // Sequentially relax in exact order
  for (const factor of RELAXATION_SEQUENCE) {
    relaxedFactors.push(factor);

    currentEligible = allCandidates.filter((c) =>
      filterWithExclusions(c, relaxedFactors)
    );

    if (currentEligible.length >= 5) {
      return {
        eligibleCandidates: currentEligible,
        relaxationStepsApplied: [...relaxedFactors],
        insufficientCandidatesReason: null,
      };
    }
  }

  // Exhausted all relaxation steps but still < 5
  return {
    eligibleCandidates: currentEligible,
    relaxationStepsApplied: [...relaxedFactors],
    insufficientCandidatesReason: `Only ${currentEligible.length} candidates satisfied mandatory compatibility criteria even after relaxing ${relaxedFactors.join(', ')}.`,
  };
}
