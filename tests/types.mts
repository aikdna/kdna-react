import * as React from 'react';
import { useKDNARead, KDNAFileInput, KDNAReadStatus, KDNAReadView } from '@aikdna/kdna-react';
import type { ReadTransportContext, KDNAReadState, ClientResult, KDNASelection } from '@aikdna/kdna-react';
declare const context: ReadTransportContext;
declare const selection: KDNASelection;
declare const result: ClientResult;
function Consumer() {
 const reader = useKDNARead({endpointUrl:'https://example.invalid/read',endpointId:'endpoint:test',sessionId:'session:test',maxFileBytes:1024});
 const p: Promise<ClientResult> = reader.read(context, {signal:new AbortController().signal});
 void p; void reader.select(new Uint8Array()); reader.cancel(); reader.release(); reader.dispose();
 const state: KDNAReadState=reader;
 React.createElement(KDNAReadView,{state});
 if(reader.selectionResult?.status==='rejected' && reader.selectionResult.states) {
   const core: 'valid'|'invalid'|'not_evaluated'=reader.selectionResult.states.core; void core;
 }
 // @ts-expect-error UI lifecycle cannot be replaced by an invented permission phase
 React.createElement(KDNAReadView,{state:{...state,phase:'authorized'}});
 return React.createElement(React.Fragment,null,React.createElement(KDNAFileInput,{onSelect:reader.select}),React.createElement(KDNAReadStatus,{state}),React.createElement(KDNAReadView,{result}));
}
void Consumer;void selection;
// @ts-expect-error caller must supply the complete official context
useKDNARead({endpointUrl:'x',endpointId:'x',sessionId:'x'}).read({});
// @ts-expect-error no raw object selection
useKDNARead({endpointUrl:'x',endpointId:'x',sessionId:'x'}).select({bytes:[]});
// @ts-expect-error no old API export
import { useKDNA, KDNALoadPlanGate } from '@aikdna/kdna-react';
// @ts-expect-error old private path is closed
import legacy from '@aikdna/kdna-react/src/trace';
// @ts-expect-error no invented local grant on public remote result
result.view.capabilities.authorization = true;
