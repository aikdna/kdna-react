import { Trace } from "./trace";

export function useTrace(trace: Trace) {
  return {
    primary: trace.decision.primary,
    advisors: trace.decision.advisors ?? [],
    rejected: trace.decision.rejected ?? [],
    confidence: trace.decision.confidence ?? "unknown",
    isOverBudget: trace.cost?.over_budget ?? false,
    shape: trace.projection?.shape ?? "answer-pattern",
  };
}
