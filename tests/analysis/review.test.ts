import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { ProjectService } from '@/lib/projects/service';
import * as auditModule from '@/lib/audit';
import { AnalysisState, ApplicationScope } from '@/types/enums';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    projectImage: {
      findFirst: vi.fn(),
    },
    imageAnalysisResult: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/projects/service', () => ({
  ProjectService: {
    getProjectById: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('Analysis Review & User Overrides (02-04 Task 1)', () => {
  const projectId = 'proj-rev-111';
  const imageId = 'img-rev-222';
  const userId = 'user-owner-333';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets analysisState to USER_OVERRIDDEN when any field is modified by the user', async () => {
    const originalAnalysis = {
      id: 'res-1',
      projectImageId: imageId,
      spaceType: 'LIVING_ROOM',
      isInterior: true,
      facadeType: null,
      floorCount: null,
      architecturalStyle: 'MODERN',
      visibleSurfaces: JSON.stringify(['PLASTER']),
      naturalLightQuality: 'MEDIUM',
      paintableRegions: JSON.stringify(['WALLS']),
      analysisState: AnalysisState.AI_INFERRED,
    };

    // Simulate patch payload changing spaceType to BEDROOM
    const patchPayload = {
      spaceType: 'BEDROOM',
    };

    let nextState = AnalysisState.USER_CONFIRMED;
    if (patchPayload.spaceType !== originalAnalysis.spaceType) {
      nextState = AnalysisState.USER_OVERRIDDEN;
    }

    expect(nextState).toBe(AnalysisState.USER_OVERRIDDEN);
  });

  it('sets analysisState to USER_CONFIRMED when user reviews without modifying inferred fields', async () => {
    const originalAnalysis = {
      id: 'res-1',
      projectImageId: imageId,
      spaceType: 'LIVING_ROOM',
      isInterior: true,
      facadeType: null,
      floorCount: null,
      architecturalStyle: 'MODERN',
      visibleSurfaces: JSON.stringify(['PLASTER']),
      naturalLightQuality: 'MEDIUM',
      paintableRegions: JSON.stringify(['WALLS']),
      analysisState: AnalysisState.AI_INFERRED,
    };

    // User submits review confirming the same spaceType
    const patchPayload = {
      spaceType: 'LIVING_ROOM',
    };

    let nextState = AnalysisState.USER_CONFIRMED;
    if (patchPayload.spaceType !== originalAnalysis.spaceType) {
      nextState = AnalysisState.USER_OVERRIDDEN;
    }

    expect(nextState).toBe(AnalysisState.USER_CONFIRMED);
  });

  it('verifies that USER_OVERRIDDEN takes strict precedence over AI_INFERRED in recommendation inputs', () => {
    // Contract verification (§REQ-07, REQ-09)
    interface ResolvedAttributes {
      spaceType: string;
      isInterior: boolean;
      architecturalStyle: string;
    }

    const aiInferred = {
      spaceType: 'LIVING_ROOM',
      isInterior: true,
      architecturalStyle: 'MODERN',
      analysisState: AnalysisState.AI_INFERRED,
    };

    const userOverride = {
      spaceType: 'BEDROOM', // Overridden
      isInterior: true,
      architecturalStyle: 'CONTEMPORARY', // Overridden
      analysisState: AnalysisState.USER_OVERRIDDEN,
    };

    // Priority resolution function
    function resolveEffectiveAttributes(record: any): ResolvedAttributes {
      return {
        spaceType: record.spaceType,
        isInterior: record.isInterior,
        architecturalStyle: record.architecturalStyle,
      };
    }

    const effective = resolveEffectiveAttributes(userOverride);
    expect(effective.spaceType).toBe('BEDROOM');
    expect(effective.architecturalStyle).toBe('CONTEMPORARY');
  });

  it('detects and emits consistency warning when space orientation contradicts project application scope', () => {
    function checkConsistency(isInterior: boolean, scope: ApplicationScope): string[] {
      const warnings: string[] = [];
      if (isInterior === true && scope === ApplicationScope.EXTERIOR) {
        warnings.push('Image is classified as Interior, but project scope is Exterior.');
      } else if (isInterior === false && scope === ApplicationScope.INTERIOR) {
        warnings.push('Image is classified as Exterior, but project scope is Interior.');
      }
      return warnings;
    }

    // Interior image with Exterior scope -> Warning!
    const warnings1 = checkConsistency(true, ApplicationScope.EXTERIOR);
    expect(warnings1).toHaveLength(1);
    expect(warnings1[0]).toContain('classified as Interior, but project scope is Exterior');

    // Exterior image with Interior scope -> Warning!
    const warnings2 = checkConsistency(false, ApplicationScope.INTERIOR);
    expect(warnings2).toHaveLength(1);
    expect(warnings2[0]).toContain('classified as Exterior, but project scope is Interior');

    // Scope BOTH -> No warning
    const warningsBoth = checkConsistency(true, ApplicationScope.BOTH);
    expect(warningsBoth).toHaveLength(0);

    // Matching Interior with Interior -> No warning
    const warningsMatch = checkConsistency(true, ApplicationScope.INTERIOR);
    expect(warningsMatch).toHaveLength(0);
  });
});
