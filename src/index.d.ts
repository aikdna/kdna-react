export type {
  JudgmentTrace,
  JudgmentTraceAssetIdentity,
  JudgmentTraceBudget,
  JudgmentTraceDeliveryEvidence,
  JudgmentTraceDigestComparison,
  JudgmentTraceDigestEvidence,
  JudgmentTraceDigestValue,
  JudgmentTraceExecution,
  JudgmentTraceHostCapabilities,
  JudgmentTraceHostReceipt,
  JudgmentTraceIssue,
  JudgmentTraceModelIdentity,
  JudgmentTracePlanRef,
  JudgmentTraceProjectionActual,
  JudgmentTraceResultRef,
  JudgmentTraceRuntimeContract,
  JudgmentTraceSemanticConsumption,
} from "./trace.js";

import type { JudgmentTrace, JudgmentTraceIssue } from "./trace.js";

export type KDNARecord = Record<string, unknown>;
export type Renderable = unknown;

export declare const KDNA_SCHEMA_AUTHORITY: Readonly<{
  core_commit: 'ca6ede2b4536215b3d42fe30404afa7d66cf4ddd';
  aggregate_sha256: '75dbb19a436667c82be430b4338bfca3fd55ba75459c47a4e90ee4f9a284de67';
  judgment_trace_sha256: 'a260e5abbcc68bf8df11ba738b5d475901b2950668c4718e415355adc723c7b0';
}>;

export interface LoadPlanState {
  status: "idle" | "checking" | "ready" | "locked" | "error" | string;
  plan: KDNARecord | null;
  missing: unknown[];
  error: Error | null;
  refresh(): Promise<LoadPlanState | null>;
}

export declare function useKDNALoadPlan(options?: {
  endpoint?: string;
  fileId?: string;
  context?: KDNARecord;
  enabled?: boolean;
}): LoadPlanState;

export declare function useKDNA(options?: {
  endpoint?: string;
  fileId?: string;
  profile?: string;
}): LoadPlanState & {
  content: unknown;
  loading: boolean;
  load(options?: KDNARecord): Promise<KDNARecord | null>;
};

export declare function KDNAFileDropzone(props: {
  endpoint?: string;
  onError?: (error: Error) => void;
  maxSizeBytes?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
  children?: Renderable | ((state: KDNARecord) => Renderable);
}): Renderable;

export declare function KDNALoadPlanGate(props: {
  fileId?: string;
  endpoint?: string;
  profile?: string;
  children?: Renderable | ((state: KDNARecord) => Renderable);
}): Renderable;

export declare function KDNAPasswordUnlockDialog(props: {
  fileId?: string;
  endpoint?: string;
  profile?: string;
  onUnlock?: (result: KDNARecord) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
  hint?: Renderable;
  title?: Renderable;
}): Renderable;

export declare function KDNALicenseActivationForm(props: {
  domain?: string;
  endpoint?: string;
  onActivated?: (token: unknown) => void;
  onError?: (error: Error) => void;
  label?: string;
  submitLabel?: string;
}): Renderable;

export declare function KDNAAssetInspector(props: {
  inspect?: KDNARecord | null;
  showProfiles?: boolean;
  showLoadPlan?: boolean;
  className?: string;
}): Renderable;

export declare function parseTrace(json: string): JudgmentTrace;
export declare function validateTrace(trace: unknown): { valid: boolean; errors: string[] };
export declare function tracePrimaryLabel(trace: JudgmentTrace): string;
export declare function traceIsOverBudget(trace: JudgmentTrace): boolean;
export declare function traceResultDigest(trace: JudgmentTrace): string | null;
export declare function KDNATraceViewer(props?: { trace?: JudgmentTrace | null; visible?: boolean }): Renderable;

export interface TraceView {
  primary: string | null;
  status: string;
  deliveryStatus: string;
  executionStatus: string;
  semanticConsumption: "not_observed";
  conformanceStatus: "not_evaluated";
  modelIdentity: string | null;
  modelIdentityBasis: "host_reported" | "not_observed";
  tokensUsed: number | null;
  usageBasis: "host_reported" | "not_observed";
  isOverBudget: boolean;
  profile: "index" | "compact" | "scenario" | "full" | null;
  profileDeviated: boolean | null;
  resultDigest: string | null;
  resultStored: boolean;
  warnings: string[];
  errors: JudgmentTraceIssue[];
  hasIssues: boolean;
  planDigest: string | null;
  capsuleDeliveryDigest: string | null;
}

export declare function useTrace(trace: JudgmentTrace): TraceView;
