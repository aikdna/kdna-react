import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { inProcessResponse } from './in-process-response.mjs';
const require = createRequire(import.meta.url);
const React = require('react'), Renderer = require('react-test-renderer');
const { renderToStaticMarkup } = require('react-dom/server');
const api = require('@aikdna/kdna-react');
const client = require('@aikdna/kdna-web-client');
const { inspectSnapshot } = require('@aikdna/kdna-core/read-boundary');
const { readNode } = require('@aikdna/kdna-read/node');
const { createTrustedReadControlProvider, createTrustedHostReadProvider } = require('@aikdna/kdna-read/embedding');
const bytes = name => readFile(new URL('./components/fixtures/' + name + '.kdna', import.meta.url));
const initial = phase => ({phase,selection:null,result:null,code:null,selectionResult:null});
const render = props => renderToStaticMarkup(React.createElement(api.KDNAReadView, props));
const endpoint = 'https://react-fixture.invalid/read';
function transport(selection, mode = 'whole_asset', judgment = null) {
  const now = Date.now(), id = 'react:' + randomUUID();
  const request = {request_id:id,tuple:selection.tuple,budget_bytes:200000,mode,selection:judgment ? {...selection.asset,judgment_id:judgment} : null,handle:null};
  if (request.selection) delete request.selection.judgment_version;
  return {association_id:'association:'+randomUUID(),endpoint_id:'endpoint:react',session_id:'session:react',endpoint_url:endpoint,
    issued_at_ms:now,expires_at_ms:now+60000,outbound_request_json:JSON.stringify(request),correlation:{state:'validated',request_id:id},
    expected_tuple:selection.tuple,expected_asset:selection.asset,expected_digests:Object.fromEntries(['A','C','E'].map(k=>[k,selection.digests[k].observed])),
    expected_snapshot_id:null,max_response_bytes:250000,max_read_ms:1000,admission_response_limit_bytes:4096};
}
/** Encode known public Read result objects for the canonical JSON transport. Test-only. */
function canonicalFixtureJSON(value) {
  if(Array.isArray(value))return '['+value.map(canonicalFixtureJSON).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalFixtureJSON(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
/** In-process native Request/Response fixture: no listener, DNS or HTTP evidence. */
function fixture() {
  const state = {calls:0,aborts:0,allow:true,hold:false,pending:[],readResults:[]};
  const control = createTrustedReadControlProvider(()=>({admission_response_limit_bytes:4096}));
  const host = createTrustedHostReadProvider({observe({request,snapshot}){
    const v=inspectSnapshot(snapshot),now=Date.now();
    return {host_id:'host:react-test',host_epoch:'epoch:1',decision_id:'decision:'+request.request_id,request_id:request.request_id,
      snapshot_id:v.snapshot_id,A:v.digests.A.observed,C:v.digests.C.observed,scope:v.ir.nodes.map(n=>n.id),issued_at:now,expires_at:now+60000,
      decision:state.allow?'allow':'deny',policy_id:'policy:synthetic-test',current_ms:now};
  },deliver(){return true;}});
  const fetch = async (url, init) => {
    state.calls++;
    if (state.hold) await new Promise((resolve,reject)=>{
      const abort=()=>{state.aborts++;reject(new DOMException('Aborted','AbortError'));};
      if(init.signal.aborted) abort();else init.signal.addEventListener('abort',abort,{once:true});
      state.pending.push(()=>{init.signal.removeEventListener('abort',abort);resolve();});
    });
    const form=await new Request(url,init).formData();
    const r=await readNode(new Uint8Array(await form.get('file').arrayBuffer()),JSON.parse(form.get('request')),control,host);
    state.readResults.push(r);assert.equal(r.channel,'read_envelope');
    const response=await inProcessResponse(url,init,{status:r.envelope.status==='ready'?200:422,headers:{'content-type':'application/json; charset=utf-8','x-kdna-channel':'read_envelope'},body:canonicalFixtureJSON(r.envelope)});
    assert.equal(Object.getOwnPropertyDescriptor(Response.prototype,'url').get.call(response),url);
    assert.equal(Object.hasOwn(response,'url'),false);
    return response;
  };
  return {state,options:{endpointUrl:endpoint,endpointId:'endpoint:react',sessionId:'session:react',fetch,timeoutMs:2000}};
}
async function harness(options) {
  let current,root,renderCount=0;
  function Probe({options}){current=api.useKDNARead(options);renderCount++;return null;}
  await Renderer.act(async()=>{root=Renderer.create(React.createElement(Probe,{options}));});
  return {get state(){return current;},get renderCount(){return renderCount;},
    async call(name,...args){let value;await Renderer.act(async()=>{value=await current[name](...args);});return value;},
    start(name,...args){let value;Renderer.act(()=>{value=current[name](...args);});return value;},
    async finish(p){let value;await Renderer.act(async()=>{value=await p;});return value;},
    async update(options){await Renderer.act(async()=>root.update(React.createElement(Probe,{options})));},
    async close(){await Renderer.act(async()=>root.unmount());}};
}
async function waitFor(predicate){for(let i=0;i<100&&!predicate();i++)await Renderer.act(async()=>{await new Promise(r=>setImmediate(r));});assert(predicate(),'bounded fixture dispatch wait');}

test('phase-aware view uses current evidence and keeps legacy result rendering',()=>{
  assert.match(render({result:null}),/Select a file, then request a read/);
  for(const [phase,phrase] of Object.entries({idle:'No file selected',selecting:'Checking the selected file',selected:'File selected',reading:'Read in progress',cancelled:'Operation cancelled',released:'File selection released',disposed:'Reader closed',rejected:'File selection was not accepted',failed:'No read response is available'})){
    const html=render({state:initial(phase)});assert(html.includes(phrase),phase);assert(!html.includes('Select a file, then request a read'));assert(!/<button|<a |<script/.test(html));
  }
  const stale={status:'failed',code:'STALE_SHOULD_NOT_DISPLAY',admission:null,view:null};
  assert(!render({state:initial('reading'),result:stale}).includes(stale.code));
  assert.match(render({state:initial('toString')}),/No read response is available/);
  assert.match(render({state:{...initial('cancelled'),selection:{}}}),/selection is still available/);
});
test('public ESM and CJS expose the same four functions and keep deep paths closed',async()=>{
  const esm=await import('@aikdna/kdna-react');
  assert.deepEqual(Object.keys(api).sort(),['KDNAFileInput','KDNAReadStatus','KDNAReadView','useKDNARead']);
  assert.deepEqual(Object.keys(esm).sort(),Object.keys(api).sort());
  for(const k of Object.keys(api))assert.equal(esm[k],api[k]);
  assert.throws(()=>require('@aikdna/kdna-react/src/index.cjs'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
  await assert.rejects(import('@aikdna/kdna-react/src/index.js'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
});
test('current component admission is delegated and its rejection is retained verbatim',async()=>{
  const f=fixture(),h=await harness(f.options);
  try{
    const valid=await h.call('select',await bytes('independent-mechanisms'));
    assert.equal(valid.status,'selected');assert.equal(h.state.selectionResult,valid);assert.equal(f.state.calls,0);
    const blockedBytes=await bytes('taxonomy-cycle'),expected=await client.selectKDNA(blockedBytes);
    assert.equal(expected.status,'rejected');assert.equal(expected.states.core,'valid');assert.equal(expected.states.interpretation,'blocked');
    const blocked=await h.call('select',blockedBytes);assert.deepEqual(blocked,expected);assert.equal(h.state.selectionResult,blocked);
    const html=render({state:h.state,maxTextCharacters:16384});assert(html.includes('blocked'));assert(html.includes(blocked.code));assert(!html.includes('No file selected'));assert.equal(f.state.calls,0);
    assert.deepEqual(h.state.selectionResult.component_failure,expected.component_failure);
    const structural=await h.call('select',new Uint8Array([1,2,3]));assert.equal(structural.status,'rejected');assert.equal(structural.states.core,'invalid');assert.equal(h.state.selectionResult,structural);
    await h.call('release');assert.equal(h.state.selectionResult,null);assert.equal(h.state.selection,null);
  }finally{await h.close();}
});
test('real public Read results render all three component types with no local authority',async()=>{
  const f=fixture(),h=await harness(f.options);
  try{
    const selected=await h.call('select',await bytes('independent-mechanisms'));
    const catalog=await h.call('read',transport(selected.selection,'catalog'));
    assert.equal(catalog.status,'received',JSON.stringify(catalog));assert.equal(catalog.view.response.body.status,'ready');
    const seen=new Set();
    for(const j of catalog.view.response.body.content.catalog){
      const result=await h.call('read',transport(selected.selection,'exact_selection',j.judgment_id));
      assert.equal(result.status,'received');assert.equal(result.view.response.body.status,'ready');
      assert.equal(result.view.capabilities.authorization,false);assert.equal(result.view.capabilities.action,false);
      assert.equal(result.view.proof_limits.remote_identity,'NOT_PROVEN');assert.equal(result.view.proof_limits.receipt_delivery,'REMOTE_CLAIM_ONLY');
      const html=render({state:h.state,maxVisibleNodes:50,maxTextCharacters:16384});
      for(const node of result.view.response.body.content.closure){
        if(node.role==='method')for(const component of node.value.component_interpretations){seen.add(component.component_type);assert(html.includes(component.component_type));assert(html.includes(component.definition_digest));}
      }
      assert(html.includes('No local authorization')||html.includes('no local authorization'));
    }
    assert.deepEqual([...seen].sort(),['candidate-set','discriminator-set','taxonomy'].sort());
    f.state.allow=false;
    const denied=await h.call('read',transport(selected.selection));assert.equal(denied.status,'received');assert.equal(denied.view.response.body.content,null);
    assert.match(render({state:h.state}),/Content not disclosed/);
  }finally{await h.close();}
});
test('cancel retains selection and suppresses late results; explicit new read is required',async()=>{
  const f=fixture(),h=await harness(f.options);
  try{
    const selected=await h.call('select',await bytes('independent-mechanisms'));f.state.hold=true;
    const pending=h.start('read',transport(selected.selection));await waitFor(()=>f.state.calls===1);
    assert.equal(h.state.phase,'reading');assert.match(render({state:h.state}),/Read in progress/);
    console.log('CURRENT_PHASE_RENDER '+JSON.stringify({phase:h.state.phase,legacy_result_only:render({result:h.state.result}),current_state:render({state:h.state}),actual_fetch_calls:f.state.calls}));
    await h.call('cancel');assert.equal(h.state.selection,selected.selection);assert.equal(h.state.selectionResult,selected);
    assert.equal((await h.finish(pending)).code,'CLIENT_CANCELLED');assert.equal(h.state.phase,'cancelled');assert.equal(f.state.calls,1);assert.equal(f.state.aborts,1);
    assert.match(render({state:h.state}),/selection is still available/);
    console.log('CURRENT_PHASE_RENDER '+JSON.stringify({phase:h.state.phase,legacy_result_only:render({result:h.state.result}),current_state:render({state:h.state}),actual_fetch_calls:f.state.calls,selection_retained:h.state.selection===selected.selection}));
    f.state.hold=false;const next=await h.call('read',transport(selected.selection));assert.equal(next.status,'received');assert.equal(f.state.calls,2);
    await h.call('release');assert.equal(h.state.selection,null);assert.equal(h.state.selectionResult,null);
    assert.equal((await h.call('read',{})).code,'REACT_SELECTION_REQUIRED');assert.equal(f.state.calls,2);
  }finally{await h.close();}
});
test('effect replacement and disposal prevent stale publication and release prior ownership',async()=>{
  const f=fixture(),h=await harness(f.options);
  try{
    const selected=await h.call('select',await bytes('independent-mechanisms'));f.state.hold=true;
    const pending=h.start('read',transport(selected.selection));await waitFor(()=>f.state.calls===1);
    await h.update({...f.options,sessionId:'session:replacement'});assert.equal(h.state.phase,'idle');assert.equal(h.state.selectionResult,null);
    assert.equal((await h.finish(pending)).code,'CLIENT_CANCELLED');assert.equal(h.state.phase,'idle');
    const external=client.createKDNAWebClient(f.options);assert.equal((await external.read(selected.selection,transport(selected.selection))).code,'CLIENT_SELECTION_INVALID');external.dispose();
    await h.call('dispose');assert.equal(h.state.phase,'disposed');assert.equal((await h.call('select',await bytes('independent-mechanisms'))).code,'REACT_DISPOSED');assert.equal(f.state.calls,1);
  }finally{await h.close();}
});
test('public text presentation remains bounded and escaped',()=>{
  const state={...initial('rejected'),code:'<script>bad</script>',selectionResult:{status:'rejected',selection:null,code:'x',states:{core:'valid',interpretation:'blocked'},diagnostics:Array.from({length:22},()=>({message:'<script>'+ 'x'.repeat(100)})),component_failure:{detail:'x'.repeat(100)}}};
  const html=render({state,maxVisibleNodes:2,maxTextCharacters:32});assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('display truncated'));assert(html.includes('20 additional diagnostics not displayed'));
  for(const bad of [{maxVisibleNodes:0},{maxVisibleNodes:51},{maxTextCharacters:Infinity}])assert.throws(()=>api.KDNAReadView({...bad,state}),RangeError);
});
test('new selection wins over a pending Blob selection; stale attempt cannot restore diagnostics',async()=>{
  const f=fixture(),h=await harness(f.options);
  try{
    const data=await bytes('independent-mechanisms');
    const first=h.start('select',new Blob([data]));
    const second=h.start('select',data);
    const current=await h.finish(second),stale=await h.finish(first);
    assert.equal(current.status,'selected');assert.equal(stale.code,'REACT_SELECTION_SUPERSEDED');
    assert.equal(h.state.selection,current.selection);assert.equal(h.state.selectionResult,current);assert.equal(f.state.calls,0);
  }finally{await h.close();}
});
test('unmount aborts current read and prevents any late render',async()=>{
  const f=fixture(),h=await harness(f.options);
  const selected=await h.call('select',await bytes('independent-mechanisms'));f.state.hold=true;
  const pending=h.start('read',transport(selected.selection));await waitFor(()=>f.state.calls===1);
  await h.close();const count=h.renderCount;
  assert.equal((await pending).code,'CLIENT_CANCELLED');assert.equal(h.renderCount,count);assert.equal(f.state.aborts,1);
});
test('overlapping reads return both real results but only latest request controls presentation',async()=>{
  const f=fixture(),h=await harness(f.options);
  try{
    const selected=await h.call('select',await bytes('independent-mechanisms'));f.state.hold=true;
    const firstContext=transport(selected.selection),secondContext=transport(selected.selection);
    const first=h.start('read',firstContext);await waitFor(()=>f.state.pending.length===1);
    const second=h.start('read',secondContext);await waitFor(()=>f.state.pending.length===2);
    f.state.pending[1]();const secondResult=await h.finish(second);assert.equal(secondResult.status,'received');
    f.state.pending[0]();const firstResult=await h.finish(first);assert.equal(firstResult.status,'received');
    assert.equal(h.state.result,secondResult);assert.equal(h.state.result.view.response.body.request_id,secondContext.correlation.request_id);
    assert.equal(firstResult.view.response.body.request_id,firstContext.correlation.request_id);assert.equal(f.state.calls,2);
  }finally{await h.close();}
});
test('native file input remains explicit, clears its value and reports callback failure',async()=>{
  let root,calls=0;const file=new File(['synthetic'],'test.kdna');
  await Renderer.act(async()=>{root=Renderer.create(React.createElement(api.KDNAFileInput,{onSelect(){calls++;return Promise.reject(new Error('test'));}}));});
  try{
    const input=root.root.findByType('input'),label=root.root.findByType('label');
    assert.equal(input.props.type,'file');assert.equal(input.props.accept,'.kdna');assert.equal(label.props.htmlFor,input.props.id);assert.equal(calls,0);
    const currentTarget={files:[file],value:'synthetic-file-path'};
    await Renderer.act(async()=>{input.props.onChange({currentTarget});});
    assert.equal(currentTarget.value,'');assert.equal(calls,1);
    assert.equal(root.root.findByProps({role:'status'}).children.join(''),'File selection could not be completed. Choose the file again.');
  }finally{await Renderer.act(async()=>root.unmount());}
});
