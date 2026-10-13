import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import {
  ApplicationScope,
  Provenance,
  RunStatus,
  ScoringFactor,
} from '@/types/enums';
import {
  CandidateContext,
  FACTOR_CALCULATORS,
} from './factors';
import { applyPaletteHarmony, RankedCandidate } from './harmony';
import { applyFilterRelaxation } from './relaxation';
import { generateExplanation } from './explanation';

export interface RecommendationRunRequest {
  projectId: string;
  manufacturerSlug: string;
  applicationScope: ApplicationScope;
}

export class RecommendationEngine {
  static async execute(req: RecommendationRunRequest): Promise<{
    runId: string;
    recommendations: RankedCandidate[];
    relaxationApplied: string[];
    paletteHarmonyApplied: boolean;
  }> {
    logger.info(
      { projectId: req.projectId, brand: req.manufacturerSlug, scope: req.applicationScope },
      '[RecommendationEngine] Starting recommendation run'
    );

    // 1. Fetch Project & Climate & Latest Image Analysis
    const project = await prisma.project.findUnique({
      where: { id: req.projectId },
      include: {
        location: {
          include: {
            climateProfile: {
              include: { observations: true },
            },
          },
        },
        images: {
          where: { processingState: 'COMPLETED' },
          include: { analysisResult: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!project) {
      throw new Error(`Project ${req.projectId} not found`);
    }

    // Climate Profile is strictly required
    const climateProfile = project.location?.climateProfile;
    if (!climateProfile || !climateProfile.observations || climateProfile.observations.length === 0) {
      const err: any = new Error('Climate profile data is required for recommendation scoring');
      err.code = 'CLIMATE_DATA_REQUIRED';
      throw err;
    }

    // Resolve Image Analysis (USER_OVERRIDDEN / USER_CONFIRMED takes precedence over AI_INFERRED)
    const latestImage = project.images?.[0];
    const analysisRecord = latestImage?.analysisResult;

    const analysis = {
      spaceType: analysisRecord?.spaceType || 'LIVING_ROOM',
      isInterior: analysisRecord?.isInterior ?? (req.applicationScope === ApplicationScope.INTERIOR),
      facadeType: analysisRecord?.facadeType || null,
      floorCount: analysisRecord?.floorCount || null,
      architecturalStyle: analysisRecord?.architecturalStyle || 'CONTEMPORARY',
      visibleSurfaces: analysisRecord?.visibleSurfaces
        ? JSON.parse(analysisRecord.visibleSurfaces)
        : ['PLASTER'],
      naturalLightQuality: analysisRecord?.naturalLightQuality || 'MEDIUM',
      paintableRegions: analysisRecord?.paintableRegions
        ? JSON.parse(analysisRecord.paintableRegions)
        : ['WALLS'],
    };

    // 2. Fetch Active Scoring Weights Version (v1.0.0)
    let weightVersion = await prisma.scoringWeightVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!weightVersion) {
      // Fallback baseline if not seeded in testing
      const baselineWeights = {
        CLIMATE_SUITABILITY: 0.20,
        INTERIOR_EXTERIOR_COMPATIBILITY: 0.15,
        SURFACE_COMPATIBILITY: 0.15,
        PRODUCT_SUITABILITY: 0.10,
        ARCHITECTURAL_CHARACTERISTICS: 0.10,
        ROOM_TYPE: 0.10,
        NATURAL_LIGHT: 0.10,
        COLOUR_FAMILY_COMPATIBILITY: 0.05,
        USER_PREFERENCES: 0.05,
      };

      weightVersion = await prisma.scoringWeightVersion.upsert({
        where: { version: 'v1.0.0' },
        update: { weights: JSON.stringify(baselineWeights), isActive: true },
        create: {
          version: 'v1.0.0',
          weights: JSON.stringify(baselineWeights),
          isActive: true,
          description: 'Default baseline weights',
        },
      });
    }

    const weights: Record<string, number> = JSON.parse(weightVersion.weights);

    // 3. Resolve Manufacturer
    const brand = await prisma.paintBrand.findUnique({
      where: { slug: req.manufacturerSlug },
      include: {
        products: {
          include: {
            shades: {
              where: {
                provenance: Provenance.VERIFIED,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!brand || !brand.isActive) {
      throw new Error(`Paint manufacturer '${req.manufacturerSlug}' is unavailable or inactive.`);
    }

    // Step 1: Gather candidate shades
    const rawCandidates: Array<{
      shade: any;
      product: any;
    }> = [];

    for (const prod of brand.products) {
      for (const shade of prod.shades) {
        rawCandidates.push({ shade, product: prod });
      }
    }

    if (rawCandidates.length === 0) {
      throw new Error(`Manufacturer '${brand.name}' has 0 verified catalogue shades.`);
    }

    // Step 2 & 7: Progressive Filtering with Relaxation
    const relaxationResult = applyFilterRelaxation(
      rawCandidates,
      (candidate, relaxedFactors) => {
        // Mandatory Filter 1: Scope compatibility
        if (req.applicationScope === ApplicationScope.INTERIOR) {
          if (
            candidate.product.applicationScope !== ApplicationScope.INTERIOR &&
            candidate.product.applicationScope !== ApplicationScope.BOTH
          ) {
            return false;
          }
        } else if (req.applicationScope === ApplicationScope.EXTERIOR) {
          if (
            candidate.product.applicationScope !== ApplicationScope.EXTERIOR &&
            candidate.product.applicationScope !== ApplicationScope.BOTH
          ) {
            return false;
          }
        }

        // Mandatory Filter 2: Surface compatibility
        if (!relaxedFactors.includes('SURFACE_COMPATIBILITY') && candidate.product.surfaceCompatibility) {
          try {
            const approved: string[] = JSON.parse(candidate.product.surfaceCompatibility);
            if (approved.length > 0 && analysis.visibleSurfaces.length > 0) {
              const hasMatch = analysis.visibleSurfaces.some((s: string) =>
                approved.includes(s.toUpperCase())
              );
              if (!hasMatch) return false;
            }
          } catch {
            // ignore JSON parse issue
          }
        }

        return true;
      }
    );

    const eligiblePool = relaxationResult.eligibleCandidates;

    // Step 3 & 4: Compute all 9 factor scores and composite score
    const scoredCandidates: RankedCandidate[] = eligiblePool.map((item) => {
      const ctx: CandidateContext = {
        shade: item.shade,
        product: item.product,
        analysis,
        climate: climateProfile,
        projectScope: req.applicationScope,
        userPreferences: null, // neutral 0.5 baseline
      };

      let compositeScore = 0;
      const factorScores: Record<string, { score: number; weight: number; weightedScore: number }> = {};

      for (const factor of Object.values(ScoringFactor)) {
        const calculator = FACTOR_CALCULATORS[factor];
        const score = calculator(ctx);
        const weight = weights[factor] || 0;
        const weightedScore = Number((score * weight).toFixed(4));
        compositeScore += weightedScore;

        factorScores[factor] = {
          score: Number(score.toFixed(4)),
          weight,
          weightedScore,
        };
      }

      return {
        shadeId: item.shade.id,
        shadeName: item.shade.shadeName,
        shadeCode: item.shade.shadeCode,
        colourFamily: item.shade.colourFamily,
        hexApprox: item.shade.hexApprox,
        productName: item.product.name,
        finishType: item.product.finishType || 'MATT',
        surfaceScope: req.applicationScope,
        compositeScore: Number(compositeScore.toFixed(4)),
        factorScores,
      };
    });

    // Step 5: Deterministic Sort: compositeScore DESC, shadeId ASC
    scoredCandidates.sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) {
        return b.compositeScore - a.compositeScore;
      }
      return a.shadeId.localeCompare(b.shadeId);
    });

    // Step 6: Palette Harmony Post-Scoring Diversity Rule
    const harmonyResult = applyPaletteHarmony(scoredCandidates);
    // For ApplicationScope.BOTH: single ranked list of exactly 5 recommendations in MVP (§REQ-09)
    const finalTop5 = harmonyResult.top5.slice(0, 5);

    // Attach natural language explanations
    for (const c of finalTop5) {
      (c as any).explanation = generateExplanation(c, {
        spaceType: analysis.spaceType,
        architecturalStyle: analysis.architecturalStyle,
        naturalLightQuality: analysis.naturalLightQuality,
      });
    }

    // Step 8 & 9: Persist RecommendationRun, Recommendations, and RecommendationFactors in Azure SQL
    const recommendationRun = await prisma.recommendationRun.create({
      data: {
        projectId: req.projectId,
        manufacturerId: brand.id,
        applicationScope: req.applicationScope,
        scoringWeightsVersionId: weightVersion.id,
        scoringWeightsVersionSnapshot: weightVersion.version,
        relaxationApplied:
          relaxationResult.relaxationStepsApplied.length > 0
            ? JSON.stringify(relaxationResult.relaxationStepsApplied)
            : null,
        paletteHarmonyApplied: harmonyResult.harmonyApplied,
        status: RunStatus.COMPLETED,
      },
    });

    for (let rank = 1; rank <= finalTop5.length; rank++) {
      const c = finalTop5[rank - 1];
      const rec = await prisma.recommendation.create({
        data: {
          runId: recommendationRun.id,
          shadeId: c.shadeId,
          rank,
          compositeScore: c.compositeScore,
          surfaceScope: c.surfaceScope,
          explanation: (c as any).explanation,
          isHarmonyReplacement: !!c.isHarmonyReplacement,
          replacedCandidateId: c.replacedCandidateId || null,
        },
      });

      // Persist 9 RecommendationFactor rows
      const factorEntries = Object.entries(c.factorScores).map(([factorName, f]) => ({
        recommendationId: rec.id,
        factorName,
        score: f.score,
        weight: f.weight,
        weightedScore: f.weightedScore,
      }));

      await prisma.recommendationFactor.createMany({
        data: factorEntries,
      });
    }

    logger.info(
      { runId: recommendationRun.id, count: finalTop5.length },
      '[RecommendationEngine] Recommendation run completed and persisted successfully'
    );

    return {
      runId: recommendationRun.id,
      recommendations: finalTop5,
      relaxationApplied: relaxationResult.relaxationStepsApplied,
      paletteHarmonyApplied: harmonyResult.harmonyApplied,
    };
  }
}
