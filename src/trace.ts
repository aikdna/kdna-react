export interface Trace {
  kdna_trace: "1.0.0";
  trace_id: string;
  timestamp: string;
  operation: string;
  decision: TraceDecision;
  cost?: TraceCost;
  projection?: TraceProjection;
  provenance?: TraceProvenance;
}

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
  tokens_consumed: number;
  chars_consumed: number;
  assets_loaded: number;
  over_budget: boolean;
}

export interface TraceProjection {
  shape: "answer-pattern" | "compact" | "scenario" | "full";
}

export interface TraceProvenance {
  route_card_version: string | null;
  consumer_index_version: string | null;
  policy_input_hash: string | null;
}

export function parseTrace(json: string): Trace {
  const parsed = JSON.parse(json);
  if (parsed.kdna_trace !== "1.0.0") {
    throw new Error(`Unknown trace version: ${parsed.kdna_trace}`);
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

  if (t.kdna_trace !== "1.0.0") {
    errors.push(`kdna_trace must be "1.0.0"`);
  }

  if (typeof t.trace_id !== "string" || !/^[0-9a-f]{32}$/.test(t.trace_id)) {
    errors.push("trace_id must be a 32-character hex string");
  }

  if (!t.decision || typeof t.decision !== "object") {
    errors.push("decision is required");
  }

  return { valid: errors.length === 0, errors };
}

export function primaryLabel(trace: Trace): string {
  return trace.decision.primary?.domain_id ?? "none";
}

export function isHighConfidenceDecision(trace: Trace): boolean {
  return (
    trace.decision.confidence === "high" &&
    trace.decision.primary !== null &&
    trace.decision.primary !== undefined
  );
}
