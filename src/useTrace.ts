import type { JudgmentTrace } from "./trace.js";

/** Typechecked mirror of the package-root `useTrace` projection. */
export function useTrace(trace: JudgmentTrace) {
  return {
    primary: trace.asset_identity.asset_id,
    status: trace.overall_status,
    deliveryStatus: trace.execution.delivery_status,
    executionStatus: trace.execution.execution_status,
    semanticConsumption: trace.execution.semantic_consumption.state,
    conformanceStatus: trace.execution.conformance_status,
    modelIdentity: trace.execution.model_identity.value,
    modelIdentityBasis: trace.execution.model_identity.basis,
    tokensUsed: trace.budget.actual.tokens_used,
    usageBasis: trace.budget.actual.usage_basis,
    isOverBudget: trace.budget.comparison.overall === "exceeded",
    profile: trace.projection_actual.profile,
    profileDeviated: trace.projection_actual.profile_deviated_from_plan,
    resultDigest: trace.result_ref?.result_digest ?? null,
    resultStored: trace.result_ref?.stored ?? false,
    warnings: trace.warnings,
    errors: trace.errors,
    hasIssues: trace.warnings.length > 0 || trace.errors.length > 0,
    planDigest: trace.plan_ref.plan_digest,
    capsuleDeliveryDigest: trace.projection_actual.capsule_delivery_digest,
  };
}
