/**
 * KDNA Trace types — wire-compatible with JudgmentTrace 0.9 candidate schema.
 *
 * Supports both 0.9.0 (trace_version) and 1.0.0 (kdna_trace) formats.
 * Consumes the trace contract — does NOT re-implement routing logic.
 */

// ── 0.9 Trace (primary target) ───────────────────────────────────────

export interface Trace {
  /** 0.9: "0.9.0"; legacy 1.0 compat: "1.0.0" */
  trace_version?: string;
  kdna_trace?: string;
  trace_id: string;
  /** 0.9: references the ConsumptionPlan */
  plan_id?: string;
  /** 0.9: "single" | "cluster" */
  mode?: string;
  timestamp: string;

  // Legacy 1.0 fields (backward compat)
  operation?: string;
  decision?: TraceDecision;

  // 0.9 fields
  asset_identity?: AssetIdentity;
  assets_loaded?: AssetLoaded[];
  cluster_identity?: ClusterIdentity;

  applicability_actual?: ApplicabilityActual;
  projection_actual?: ProjectionActual;
  selection_actual?: SelectionActual;

  execution?: Execution;
  result_ref?: ResultRef;
  cost?: TraceCost;
  evaluation?: Evaluation;
  source_attribution?: SourceAttribution[];
  conflicts?: Array<{
    type: string;
    assets: string[];
    description: string;
    severity?: string;
    resolution?: string;
  }>;
  provenance?: TraceProvenance;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

// ── 0.9 Sub-types ────────────────────────────────────────────────────

export interface AssetIdentity {
  asset_id: string;
  version: string;
  digest: string;
  digest_verified: boolean;
  signature_verified?: boolean | null;
  revocation_status?: string;
  authorization?: string;
  projection_digest?: string;
}

export interface AssetLoaded {
  asset_id: string;
  version: string;
  digest: string;
  role: string;
  weight: number;
  digest_verified: boolean;
  authorization?: string;
  projection_digest?: string;
  contribution_hypothesis?: string;
  contribution_fulfilled?: boolean;
  failure_reason?: string;
}

export interface ClusterIdentity {
  cluster_id: string;
  version: string;
  manifest_digest: string;
}

export interface ApplicabilityActual {
  decision: string;
  confidence: string;
  boundary_respected: boolean;
  deviated_from_plan?: boolean;
}

export interface ProjectionActual {
  shape: string;
  content_digest?: string;
  shape_deviated_from_plan?: boolean;
}

export interface SelectionActual {
  primary: string | null;
  advisors: string[];
  rejected: Array<{ asset_id: string; reason: string }>;
  deviated_from_plan?: boolean;
}

export interface Execution {
  status: string;
  runner_id?: string;
  runner_version?: string;
  model?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  attempts?: number;
}

export interface ResultRef {
  result_hash?: string;
  result_shape?: string;
  answer_summary?: string;
  result_stored?: boolean;
}

export interface SourceAttribution {
  asset_id: string;
  axioms_triggered: number;
  transfer_depth?: {
    operationalized: number;
    referenced: number;
    mentioned: number;
  };
}

export interface Evaluation {
  self_checks?: Array<{ check_id: string; passed: boolean; detail?: string }>;
  violations?: Array<{ type: string; severity: string; description: string; asset_id?: string }>;
  banned_terms_detected?: string[];
}

// ── Legacy 1.0 types (backward compat) ────────────────────────────────

export interface TraceDecision {
  primary: TraceDomainEntry | null;
  advisors: TraceDomainEntry[];
  rejected: TraceRejectedEntry[];
  budget_profile: string;
  confidence: string;
  abstain_reason: string | null;
}

export interface TraceDomainEntry {
  domain_id: string;
  weight: number;
  reason?: string;
  role?: string;
}

export interface TraceRejectedEntry {
  domain_id: string;
  reason?: string;
}

export interface TraceCost {
  tokens_consumed?: number;
  tokens_used?: number;
  chars_consumed?: number;
  assets_loaded?: number;
  model_calls?: number;
  budget_profile?: string;
  over_budget?: boolean;
  over_budget_reason?: string;
}

export interface TraceProjection {
  shape: "answer-pattern" | "compact" | "scenario" | "full";
}

export interface TraceProvenance {
  plan_digest?: string | null;
  route_card_version?: string | null;
  consumer_index_version?: string | null;
  policy_input_hash?: string | null;
  policy_hash?: string | null;
  cluster_manifest_digest?: string | null;
}

// ── Parsing ───────────────────────────────────────────────────────────

export function parseTrace(json: string): Trace {
  const parsed = JSON.parse(json);
  const version = parsed.trace_version || parsed.kdna_trace;
  if (!version) {
    throw new Error("Unknown trace format: missing trace_version or kdna_trace");
  }
  return parsed as Trace;
}

export function validateTrace(
  trace: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!trace || typeof trace !== "object") {
    return { valid: false, errors: ["trace must be an object"] };
  }

  const t = trace as Record<string, unknown>;

  // Accept both 0.9 and 1.0 version fields
  const version = t.trace_version || t.kdna_trace;
  if (!version) {
    errors.push("trace must have trace_version (0.9) or kdna_trace (1.0)");
  }

  if (typeof t.trace_id !== "string" || t.trace_id.length < 16) {
    errors.push("trace_id must be a string of at least 16 chars");
  }

  // 0.9: plan_id is required
  if (t.trace_version === "0.9.0" && typeof t.plan_id !== "string") {
    errors.push("plan_id is required for 0.9 trace");
  }

  // 0.9: execution.status required
  if (t.trace_version === "0.9.0" && (!t.execution || typeof t.execution !== "object")) {
    errors.push("execution is required for 0.9 trace");
  }

  return { valid: errors.length === 0, errors };
}

// ── Helpers ───────────────────────────────────────────────────────────

export function primaryLabel(trace: Trace): string {
  // 0.9 single mode
  if (trace.asset_identity?.asset_id) return trace.asset_identity.asset_id;
  // 0.9 cluster mode
  if (trace.assets_loaded?.length) {
    const primary = trace.assets_loaded.find(a => a.role === "primary");
    if (primary) return primary.asset_id;
  }
  // 0.9 selection
  if (trace.selection_actual?.primary) return trace.selection_actual.primary;
  // legacy
  return trace.decision?.primary?.domain_id ?? "none";
}

export function isTrustedDecision(trace: Trace): boolean {
  // 0.9: check execution + result
  if (trace.execution?.status === "completed" && trace.result_ref?.result_stored) {
    if (trace.evaluation?.violations?.length) return false;
    return true;
  }
  // legacy compat
  return (
    trace.decision?.confidence === "high" &&
    trace.decision?.primary !== null &&
    trace.decision?.primary !== undefined
  );
}

export function isOverBudget(trace: Trace): boolean {
  return trace.cost?.over_budget ?? false;
}

export function answerSummary(trace: Trace): string {
  return trace.result_ref?.answer_summary ?? "";
}

export function traceMode(trace: Trace): string {
  return trace.mode ?? "single";
}

export function hasWarnings(trace: Trace): boolean {
  return (trace.warnings?.length ?? 0) > 0;
}
