import React from 'react';
import { createRoot } from 'react-dom/client';
import * as api from '@aikdna/kdna-react';
export async function makeDriver(options){
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let value,closed=false,renderCount=0,limits={};const counts={setup:0,cleanup:0};
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 function Probe(){value=api.useKDNARead(options);renderCount++;React.useEffect(()=>{counts.setup++;return()=>{counts.cleanup++;};},[]);return React.createElement(React.Fragment,null,React.createElement(api.KDNAFileInput,{onSelect:value.select}),React.createElement(api.KDNAReadStatus,{state:value}),React.createElement(api.KDNAReadView,{result:value.result,...limits}));}
 const draw=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Probe)));
 await React.act(async()=>{draw();});
 return {kind:'browser',state:()=>value,renders:()=>renderCount,effects:()=>({...counts}),html:()=>container.innerHTML,
 async invoke(name,...args){let result;await React.act(async()=>{result=await value[name](...args);});return result;},
 start(name,...args){let result;React.act(()=>{result=value[name](...args);});return result;},
 async finish(p){let result;await React.act(async()=>{result=await p;});return result;},
 async update(next){options=next;await React.act(async()=>{draw();});},
 async limits(next){limits=next;await React.act(async()=>{draw();});},async waitForFetch(){await React.act(async()=>{await new Promise(r=>setTimeout(r,0));});},async drain(){await React.act(async()=>{await new Promise(r=>setTimeout(r,0));});},
 async unmount(){if(closed)return;closed=true;await React.act(async()=>{root.unmount();});container.remove();}
 };
}
