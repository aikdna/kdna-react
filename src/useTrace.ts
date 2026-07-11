import { Trace } from "./trace";

/**
 * useTrace — Consume a KDNA trace (0.9 or legacy 1.0) and return
 * structured display fields. Single-asset default. Cluster-aware.
 */
export function useTrace(trace: Trace) {
  const isCluster = trace.mode === "cluster";
  const is09 = trace.trace_version === "0.9.0";

  // Primary
  const primary = isCluster
    ? (trace.assets_loaded?.find(a => a.role === "primary")?.asset_id ??
       trace.selection_actual?.primary ??
       trace.decision?.primary?.domain_id ?? null)
    : (trace.asset_identity?.asset_id ??
       trace.decision?.primary?.domain_id ?? null);

  // Advisors
  const advisors = isCluster
    ? (trace.assets_loaded
        ?.filter(a => a.role === "advisor")
        .map(a => ({
          asset_id: a.asset_id,
          weight: a.weight,
          contribution_fulfilled: a.contribution_fulfilled,
          contribution_hypothesis: a.contribution_hypothesis,
        })) ?? [])
    : [];

  // Rejected
  const rejected = trace.selection_actual?.rejected?.map(r => ({
    asset_id: r.asset_id,
    reason: r.reason ?? "unknown",
  })) ?? trace.decision?.rejected ?? [];

  // Confidence (0.9: execution status determines)
  const confidence = trace.applicability_actual?.confidence ??
    trace.decision?.confidence ?? "unknown";

  // Status
  const status = trace.execution?.status ?? (is09 ? "unknown" : "completed");

  // Cost
  const tokensUsed = trace.cost?.tokens_used ?? trace.cost?.tokens_consumed ?? 0;
  const isOverBudget = trace.cost?.over_budget ?? false;
  const overBudgetReason = trace.cost?.over_budget_reason ?? null;

  // Projection
  const shape = trace.projection_actual?.shape ??
    trace.projection?.shape ?? "answer-pattern";
  const shapeDeviated = trace.projection_actual?.shape_deviated_from_plan ?? false;

  // Result
  const answerSummary = trace.result_ref?.answer_summary ?? "";
  const hasResult = trace.result_ref?.result_stored ?? false;

  // Evaluation
  const selfChecks = trace.evaluation?.self_checks ?? [];
  const selfChecksPassed = selfChecks.filter(c => c.passed).length;
  const selfChecksTotal = selfChecks.length;
  const violations = trace.evaluation?.violations ?? [];
  const bannedTerms = trace.evaluation?.banned_terms_detected ?? [];

  // Warnings / Errors
  const warnings = trace.warnings ?? [];
  const errors = trace.errors ?? [];
  const hasIssues = warnings.length > 0 || errors.length > 0;

  // Attribution
  const attribution = trace.source_attribution?.map(a => ({
    asset_id: a.asset_id,
    axiomsTriggered: a.axioms_triggered,
    operationalized: a.transfer_depth?.operationalized ?? 0,
    referenced: a.transfer_depth?.referenced ?? 0,
    mentioned: a.transfer_depth?.mentioned ?? 0,
  })) ?? [];

  // Provenance
  const planDigest = trace.provenance?.plan_digest ?? null;
  const clusterDigest = trace.provenance?.cluster_manifest_digest ?? null;

  return {
    primary,
    advisors,
    rejected,
    confidence,
    status,
    tokensUsed,
    isOverBudget,
    overBudgetReason,
    shape,
    shapeDeviated,
    answerSummary,
    hasResult,
    selfChecksPassed,
    selfChecksTotal,
    violations,
    bannedTerms,
    warnings,
    errors,
    hasIssues,
    attribution,
    planDigest,
    clusterDigest,
    isCluster,
    is09,
    mode: trace.mode ?? "single",
  };
}
