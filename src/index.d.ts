export type {
  ApplicabilityActual,
  AssetIdentity,
  AssetLoaded,
  ClusterIdentity,
  Evaluation,
  Execution,
  ProjectionActual,
  ResultRef,
  SelectionActual,
  SourceAttribution,
  Trace,
  TraceCost,
  TraceProvenance,
} from "./trace.js";

import type { Trace } from "./trace.js";

export type KDNARecord = Record<string, unknown>;
export type Renderable = unknown;

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

export declare function parseTrace(json: string): Trace;
export declare function validateTrace(trace: unknown): { valid: boolean; errors: string[] };
export declare function tracePrimaryLabel(trace: Trace): string;
export declare function traceIsOverBudget(trace: Trace): boolean;
export declare function traceAnswerSummary(trace: Trace): string;
export declare function KDNATraceViewer(props?: { trace?: Trace | null; visible?: boolean }): Renderable;

export interface TraceView {
  primary: string | null;
  advisors: unknown[];
  rejected: unknown[];
  confidence: string;
  status: string;
  tokensUsed: number;
  isOverBudget: boolean;
  overBudgetReason: string | null;
  shape: string;
  shapeDeviated: boolean;
  answerSummary: string;
  hasResult: boolean;
  selfChecksPassed: number;
  selfChecksTotal: number;
  violations: unknown[];
  bannedTerms: string[];
  warnings: string[];
  errors: string[];
  hasIssues: boolean;
  attribution: unknown[];
  planDigest: string | null;
  clusterDigest: string | null;
  isCluster: boolean;
  mode: string;
}

export declare function useTrace(trace: Trace): TraceView;
