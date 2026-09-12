import { createRequire } from 'node:module';
const require=createRequire(new URL('../package.json',import.meta.url));
const React=require('react'),Renderer=require('react-test-renderer');
const {renderToStaticMarkup}=require('react-dom/server');
export const api=require('@aikdna/kdna-react');
export const publicClient=require('@aikdna/kdna-web-client');
export async function makeDriver(options){
 let value,root,closed=false,renderCount=0,limits={};const counts={setup:0,cleanup:0};
 function Probe(){value=api.useKDNARead(options);renderCount++;React.useEffect(()=>{counts.setup++;return()=>{counts.cleanup++;};},[]);return null;}
 await Renderer.act(async()=>{root=Renderer.create(React.createElement(React.StrictMode,null,React.createElement(Probe)));});
 return {kind:'node',state:()=>value,renders:()=>renderCount,effects:()=>({...counts}),
 html:()=>renderToStaticMarkup(React.createElement('div',null,React.createElement(api.KDNAFileInput,{onSelect:value.select}),React.createElement(api.KDNAReadStatus,{state:value}),React.createElement(api.KDNAReadView,{result:value.result,...limits}))),
 async invoke(name,...args){let result;await Renderer.act(async()=>{result=await value[name](...args);});return result;},
 start(name,...args){let result;Renderer.act(()=>{result=value[name](...args);});return result;},
 async finish(p){let result;await Renderer.act(async()=>{result=await p;});return result;},
 async update(next){options=next;await Renderer.act(async()=>{root.update(React.createElement(React.StrictMode,null,React.createElement(Probe)));});},
 async limits(next){limits=next;},async waitForFetch(){await Renderer.act(async()=>{await new Promise(r=>setTimeout(r,0));});},async drain(){await Renderer.act(async()=>{await new Promise(r=>setTimeout(r,0));});},
 async unmount(){if(closed)return;closed=true;await Renderer.act(async()=>{root.unmount();});}
 };
}
