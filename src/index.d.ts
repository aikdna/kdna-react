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
import type { ReactNode } from "react";
import type {
  KDNAInspectResponse,
  KDNALoadResponse,
  KDNARuntimeCapsule,
} from "@aikdna/kdna-web-client";

export type {
  KDNAInspectResponse,
  KDNALoadResponse,
  KDNARuntimeCapsule,
} from "@aikdna/kdna-web-client";

export type KDNARecord = Record<string, unknown>;
export type Renderable = ReactNode;
export type KDNALoadPlanStatus = "idle" | "checking" | "ready" | "locked" | "error";

export class KDNAActivationError extends Error {
  code: string;
  status: number | null;
  /** Always null. Activation response bodies are never attached to errors. */
  response: null;
  constructor(message: string, options?: { code?: string; status?: number });
}

export declare const KDNA_SCHEMA_AUTHORITY: Readonly<{
  core_commit: '1e77e3e0d486c330fe9f9262b514ef24c859d469';
  aggregate_sha256: '8c38138e18ac5b465d779aeaf9fadcdd846236b0f96e7b144a6cc5c228ad480d';
  judgment_trace_sha256: 'a260e5abbcc68bf8df11ba738b5d475901b2950668c4718e415355adc723c7b0';
}>;

export interface LoadPlanState {
  status: KDNALoadPlanStatus;
  plan: KDNARecord | null;
  missing: string[];
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
  content: KDNARuntimeCapsule["context"] | null;
  loading: boolean;
  load(options?: KDNARecord): Promise<KDNALoadResponse | null>;
};

export interface KDNAFileDropzoneState {
  file: File | null;
  fileId: string | null;
  inspect: KDNAInspectResponse | null;
  loading: boolean;
  error: Error | null;
  reset(): void;
}

export declare function KDNAFileDropzone(props: {
  endpoint: string;
  onError?: (error: Error) => void;
  maxSizeBytes?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
  children?: Renderable | ((state: KDNAFileDropzoneState) => Renderable);
}): Renderable;

export interface KDNALoadPlanGateState {
  status: KDNALoadPlanStatus | "loaded";
  content: KDNARuntimeCapsule["context"] | null;
  missing: string[];
  error: Error | null;
  loading: boolean;
  plan: KDNARecord | null;
  load(options?: KDNARecord): Promise<KDNALoadResponse | null>;
}

export declare function KDNALoadPlanGate(props: {
  fileId: string;
  endpoint: string;
  profile?: string;
  children?: Renderable | ((state: KDNALoadPlanGateState) => Renderable);
}): Renderable;

export declare function KDNAPasswordUnlockDialog(props: {
  fileId: string;
  endpoint: string;
  profile?: string;
  onUnlock?: (result: KDNALoadResponse) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
  hint?: Renderable;
  title?: Renderable;
}): Renderable;

export interface KDNAActivationEntitlement {
  version: string;
  license_id: string;
  domain: string;
  issued_to: string | null;
  issued_at: string;
  expires_at: string | null;
  status: "active";
  revoked: false;
  revoked_at: null;
  revocation_reason: null;
  require_machine_binding: boolean;
  require_online_check: boolean;
  offline_grace_days: number;
  allowed_agents: string[] | null;
  last_checked_at: string;
  offline_valid_until: string;
  updated_at: string;
  machine_fingerprint?: string;
  signature_base64: string;
}

export declare function KDNALicenseActivationForm(props: {
  domain: string;
  endpoint: string;
  machineFingerprint?: string;
  client?: string;
  onActivated?: (entitlement: KDNAActivationEntitlement) => void;
  onError?: (error: Error) => void;
  label?: string;
  submitLabel?: string;
}): Renderable;

export declare function KDNAAssetInspector(props: {
  inspect?: KDNAInspectResponse | null;
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
