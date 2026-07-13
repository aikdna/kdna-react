/**
 * KDNA Trace types — wire-compatible with the current JudgmentTrace contract.
 *
 * Consumes the trace contract — does NOT re-implement routing logic.
 */

// ── JudgmentTrace ────────────────────────────────────────────────────

export interface Trace {
  trace_version: "0.9.0";
  trace_id: string;
  /** References the ConsumptionPlan that was actually executed. */
  plan_id: string;
  mode: "single" | "cluster";
  timestamp: string;
  asset_identity?: AssetIdentity;
  assets_loaded?: AssetLoaded[];
  cluster_identity?: ClusterIdentity;

  applicability_actual?: ApplicabilityActual;
  projection_actual?: ProjectionActual;
  selection_actual?: SelectionActual;

  execution: Execution;
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

// ── Sub-types ────────────────────────────────────────────────────────

export interface AssetIdentity {
  asset_id: string;
  version: string;
  digest: string | null;
  digest_verified: boolean;
  signature_verified?: boolean | null;
  revocation_status?: string | null;
  authorization?: string;
  projection_digest?: string | null;
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
  rejected: Array<{ asset_id: string; reason: string | null }>;
  deviated_from_plan?: boolean;
}

export interface Execution {
  status: "completed" | "blocked" | "cancelled" | "timed_out" | "runner_error" | "partial";
  runner_id?: string;
  runner_version?: string;
  model?: string | null;
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

export interface TraceCost {
  tokens_used?: number;
  chars_consumed?: number;
  assets_loaded?: number;
  model_calls?: number;
  budget_profile?: string;
  over_budget?: boolean;
  over_budget_reason?: string;
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

const TRACE_VERSION = "0.9.0";

export function parseTrace(json: string): Trace {
  const parsed = JSON.parse(json);
  const version = parsed.trace_version;
  if (!version) {
    throw new Error("Unknown trace format: missing trace_version");
  }
  if (version !== TRACE_VERSION) {
    throw new Error(`Unknown trace version: ${version}. Expected ${TRACE_VERSION}.`);
  }
  const validation = validateTrace(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid JudgmentTrace: ${validation.errors.join("; ")}`);
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

  const version = t.trace_version;
  if (!version) {
    errors.push("trace must have trace_version");
  }

  if (typeof t.trace_id !== "string" || t.trace_id.length < 16) {
    errors.push("trace_id must be a string of at least 16 chars");
  }

  if (typeof t.plan_id !== "string") {
    errors.push("plan_id is required");
  }

  if (t.mode !== "single" && t.mode !== "cluster") {
    errors.push("mode must be single or cluster");
  }

  if (typeof t.timestamp !== "string") {
    errors.push("timestamp is required");
  }

  if (!t.execution || typeof t.execution !== "object") {
    errors.push("execution is required");
  }

  if (version && version !== TRACE_VERSION) {
    errors.push(`unknown trace_version: "${version}" — expected ${TRACE_VERSION}`);
  }

  // Unknown execution status → fail closed
  const KNOWN_EXECUTION_STATUSES = new Set([
    "completed", "blocked", "cancelled", "timed_out", "runner_error", "partial",
  ]);
  if (t.execution && typeof t.execution === "object") {
    const exec = t.execution as Record<string, unknown>;
    if (typeof exec.status === "string" && !KNOWN_EXECUTION_STATUSES.has(exec.status)) {
      errors.push(`unknown execution status: "${exec.status}" — expected completed|blocked|cancelled|timed_out|runner_error|partial`);
    }
  }

  if (t.mode === "single" && (!t.asset_identity || typeof t.asset_identity !== "object")) {
    errors.push("asset_identity is required for single mode");
  }

  if (t.mode === "cluster") {
    if (!t.cluster_identity || typeof t.cluster_identity !== "object") {
      errors.push("cluster_identity is required for cluster mode");
    }
    if (!Array.isArray(t.assets_loaded)) {
      errors.push("assets_loaded is required for cluster mode");
    }
    if (!t.selection_actual || typeof t.selection_actual !== "object") {
      errors.push("selection_actual is required for cluster mode");
    }
  }

  const execution = t.execution as Record<string, unknown> | undefined;
  if (execution?.status === "completed" && (!t.result_ref || typeof t.result_ref !== "object")) {
    errors.push("result_ref is required when execution completed");
  }

  return { valid: errors.length === 0, errors };
}

// ── Helpers ───────────────────────────────────────────────────────────

export function primaryLabel(trace: Trace): string {
  if (trace.asset_identity?.asset_id) return trace.asset_identity.asset_id;
  if (trace.assets_loaded?.length) {
    const primary = trace.assets_loaded.find(a => a.role === "primary");
    if (primary) return primary.asset_id;
  }
  if (trace.selection_actual?.primary) return trace.selection_actual.primary;
  return "none";
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
