/**
 * Browser-facing types for the sole current KDNA JudgmentTrace contract.
 * Cryptographic and semantic conformance are established by KDNA Core, not by
 * these rendering types.
 */

export interface JudgmentTracePlanRef {
  plan_id: string;
  plan_digest_profile: "kdna.canonicalization.consumption-plan-jcs";
  plan_digest_profile_version: "0.1.0";
  plan_digest: string;
  comparison: "matched";
}

export interface JudgmentTraceHostCapabilities {
  type: "kdna.agent-host-capabilities";
  protocol_version: "0.1.0";
  capability_basis: "registered_descriptor" | "legacy_assumption";
  host_protocols: Array<"kdna.agent-host">;
  capsule_versions: Array<"0.1.0">;
  capsule_digest_profiles: Array<"kdna.canonicalization.runtime-capsule-jcs">;
  capsule_digest_profile_versions: ["0.1.0"];
}

export interface JudgmentTraceRuntimeContract {
  plan_capsule_versions: ["0.1.0"];
  core_capsule_versions: Array<"0.1.0">;
  plan_host_protocols: ["kdna.agent-host"];
  host_capabilities: JudgmentTraceHostCapabilities;
  negotiation_state: "selected" | "blocked" | "not_started";
  selected_capsule_version: "0.1.0" | null;
  selected_host_protocol: "kdna.agent-host" | null;
  issue_code:
    | "KDNA_CAPSULE_CONTRACT_VERSION_UNSUPPORTED"
    | "KDNA_HOST_PROTOCOL_UNSUPPORTED"
    | "KDNA_HOST_CAPSULE_PAIR_UNSUPPORTED"
    | null;
}

export interface JudgmentTraceAssetIdentity {
  asset_id: string;
  asset_uid: string;
  version: string;
  judgment_version: string;
  access: "public" | "licensed" | "remote";
}

export interface JudgmentTraceDigestComparison {
  state: "matched" | "mismatched" | "not_compared";
  against: "external_expected" | "manifest_declaration" | "checksum_declaration" | null;
  expected: string | null;
  source: string | null;
}

export interface JudgmentTraceDigestValue {
  value: string;
  basis: string;
  comparison: JudgmentTraceDigestComparison;
}

export interface JudgmentTraceDigestEvidence {
  profile: "kdna.digest-evidence";
  profile_version: "0.1.0";
  asset: JudgmentTraceDigestValue;
  content: JudgmentTraceDigestValue;
  runtime_entry_set: JudgmentTraceDigestValue;
}

export interface JudgmentTraceDeliveryEvidence {
  basis: "kdna.canonicalization.runtime-capsule-jcs";
  basis_version: "0.1.0";
  observed: string | null;
  sender_computed: boolean;
  host_recomputed: string | null;
  host_echoed: string | null;
  delivered_capsule_version: "0.1.0" | null;
  host_boundary_comparison: "matched" | "mismatched" | "not_delivered" | "not_observed" | "unavailable";
  request_id: string | null;
}

export interface JudgmentTraceProjectionActual {
  profile: "index" | "compact" | "scenario" | "full" | null;
  capsule_delivery_digest: string | null;
  profile_deviated_from_plan: boolean | null;
}

export interface JudgmentTraceSemanticConsumption {
  state: "not_observed";
  basis: null;
}

export interface JudgmentTraceModelIdentity {
  value: string | null;
  basis: "host_reported" | "not_observed";
}

export interface JudgmentTraceExecution {
  delivery_status: "correlated_response" | "rejected_before_execution" | "not_delivered";
  semantic_consumption: JudgmentTraceSemanticConsumption;
  execution_status: "completed" | "not_started" | "failed" | "cancelled" | "timed_out";
  conformance_status: "not_evaluated";
  model_identity: JudgmentTraceModelIdentity;
}

export interface JudgmentTraceBudget {
  limits: {
    max_projection_chars: number;
    max_task_chars: number;
    deadline_ms: number;
    max_tokens: number | null;
    max_model_calls: number | null;
  };
  actual: {
    projection_chars: number | null;
    task_chars: number;
    elapsed_ms: number | null;
    elapsed_basis: "host_monotonic" | "not_observed";
    tokens_used: number | null;
    model_calls: number | null;
    usage_basis: "host_reported" | "not_observed";
  };
  comparison: {
    projection_chars: "within_limit" | "exceeded" | "not_observed";
    task_chars: "within_limit" | "exceeded";
    elapsed_ms: "within_limit" | "exceeded" | "not_observed";
    tokens_used: "within_limit" | "exceeded" | "not_limited" | "not_observed";
    model_calls: "within_limit" | "exceeded" | "not_limited" | "not_observed";
    overall: "within_limit" | "exceeded" | "not_observed";
  };
}

export interface JudgmentTraceIssue {
  code: string;
  message: string;
  phase: "plan" | "negotiation" | "load" | "budget" | "delivery" | "host" | "execution";
}

export interface JudgmentTraceResultRef {
  shape: "structured_judgment";
  result_digest: string;
  basis: "kdna.canonicalization.result-jcs";
  stored: boolean;
}

export interface JudgmentTraceHostReceipt {
  protocol: "kdna.agent-host";
  protocol_version: "0.1.0";
  request_id: string;
  runtime_receipt: Record<string, unknown>;
  outcome: Record<string, unknown> | null;
}

export interface JudgmentTrace {
  type: "kdna.judgment-trace";
  contract_version: "0.1.0";
  trace_id: string;
  plan_ref: JudgmentTracePlanRef;
  parent_trace_id: string | null;
  timestamp: string;
  overall_status: "execution_completed" | "blocked" | "execution_failed" | "cancelled" | "timed_out";
  runtime_contract: JudgmentTraceRuntimeContract;
  asset_identity: JudgmentTraceAssetIdentity;
  digest_evidence: JudgmentTraceDigestEvidence;
  capsule_delivery_evidence: JudgmentTraceDeliveryEvidence;
  projection_actual: JudgmentTraceProjectionActual;
  host_receipt: JudgmentTraceHostReceipt | null;
  execution: JudgmentTraceExecution;
  budget: JudgmentTraceBudget;
  result_ref: JudgmentTraceResultRef | null;
  errors: JudgmentTraceIssue[];
  warnings: string[];
}
