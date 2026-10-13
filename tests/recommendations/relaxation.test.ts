import { describe, it, expect } from 'vitest';
import {
  applyFilterRelaxation,
  RELAXATION_SEQUENCE,
} from '@/lib/recommendations/relaxation';

describe('Filter Relaxation Algorithm (02-05 Task 1)', () => {
  it('applies relaxation in the exact order: COLOUR_FAMILY_COMPATIBILITY -> NATURAL_LIGHT -> ROOM_TYPE -> ARCHITECTURAL_CHARACTERISTICS', () => {
    expect(RELAXATION_SEQUENCE).toEqual([
      'COLOUR_FAMILY_COMPATIBILITY',
      'NATURAL_LIGHT',
      'ROOM_TYPE',
      'ARCHITECTURAL_CHARACTERISTICS',
    ]);
  });

  it('stops at the first relaxation step that yields >= 5 eligible candidates', () => {
    const mockCandidates = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // Filter simulation:
    // Without relaxation: only 2 pass
    // With COLOUR_FAMILY_COMPATIBILITY: 6 pass
    const filterFn = (candidate: number, relaxed: string[]) => {
      if (relaxed.includes('COLOUR_FAMILY_COMPATIBILITY')) {
        return candidate <= 6;
      }
      return candidate <= 2;
    };

    const result = applyFilterRelaxation(mockCandidates, filterFn);

    expect(result.eligibleCandidates).toHaveLength(6);
    expect(result.relaxationStepsApplied).toEqual(['COLOUR_FAMILY_COMPATIBILITY']);
    expect(result.insufficientCandidatesReason).toBeNull();
  });

  it('applies multiple sequential steps if earlier steps yield fewer than 5 candidates', () => {
    const mockCandidates = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const filterFn = (candidate: number, relaxed: string[]) => {
      if (relaxed.includes('NATURAL_LIGHT')) {
        return candidate <= 7;
      }
      if (relaxed.includes('COLOUR_FAMILY_COMPATIBILITY')) {
        return candidate <= 3;
      }
      return candidate <= 1;
    };

    const result = applyFilterRelaxation(mockCandidates, filterFn);

    expect(result.eligibleCandidates).toHaveLength(7);
    expect(result.relaxationStepsApplied).toEqual([
      'COLOUR_FAMILY_COMPATIBILITY',
      'NATURAL_LIGHT',
    ]);
  });
});
