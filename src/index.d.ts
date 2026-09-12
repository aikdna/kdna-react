import type { ReactElement } from 'react';
import type { createKDNAWebClient, ClientResult, KDNASelection, SelectionResult } from '@aikdna/kdna-web-client';
export type { ClientResult, KDNASelection, SelectionResult, RemoteReadViewModel } from '@aikdna/kdna-web-client';
export type KDNAReadOptions = Parameters<typeof createKDNAWebClient>[0] & { maxFileBytes?: number };
export type ReadTransportContext = Parameters<ReturnType<typeof createKDNAWebClient>['read']>[1];
export type KDNAReadPhase = 'idle' | 'selecting' | 'selected' | 'reading' | 'received' | 'rejected' | 'failed' | 'cancelled' | 'released' | 'disposed';
export interface KDNAReadState {
  readonly phase: KDNAReadPhase;
  readonly selection: KDNASelection | null;
  /** Exact public selection result for the current file attempt; not Read permission. */
  readonly selectionResult?: SelectionResult | null;
  readonly result: ClientResult | null;
  readonly code: string | null;
}
export interface KDNAReadController extends KDNAReadState {
  select(input: File | Blob | ArrayBuffer | Uint8Array): Promise<SelectionResult>;
  read(context: ReadTransportContext, settings?: { signal?: AbortSignal }): Promise<ClientResult>;
  cancel(): void;
  release(): void;
  dispose(): void;
}
export declare function useKDNARead(options: KDNAReadOptions): KDNAReadController;
export interface KDNAFileInputProps {
  onSelect(file: File): unknown | Promise<unknown>;
  label?: string;
  disabled?: boolean;
  className?: string;
}
export declare function KDNAFileInput(props: KDNAFileInputProps): ReactElement;
export declare function KDNAReadStatus(props: { state: KDNAReadState; className?: string }): ReactElement;
export declare function KDNAReadView(props: { result?: ClientResult | null; state?: KDNAReadState; maxVisibleNodes?: number; maxTextCharacters?: number; className?: string }): ReactElement;
