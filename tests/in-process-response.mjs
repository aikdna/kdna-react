/** Fixed test transport. Native fetch creates its own Response and URL metadata.
 * No socket is opened; response bytes are synthetic/public-Read fixture output.
 * This helper changes neither globals nor public admission behavior.
 */
export function inProcessResponse(url, init, {status,headers,body}) {
  const data=Buffer.from(body);
  const rawHeaders=Object.entries(headers).flatMap(([k,v])=>[Buffer.from(k),Buffer.from(v)]);
  const dispatcher={dispatch(options,handler){
    const modern=typeof handler.onRequestStart==='function';
    let paused=false,ended=false,aborted=false,offset=0;
    const fail=error=>{if(ended||aborted)return;aborted=true;if(modern)handler.onResponseError(controller,error);else handler.onError(error);};
    const pump=()=>{
      while(!paused&&!ended&&!aborted&&offset<data.length){
        const chunk=data.subarray(offset,Math.min(offset+8192,data.length));offset+=chunk.length;
        if(modern)handler.onResponseData(controller,chunk);else if(handler.onData(chunk)===false)paused=true;
      }
      if(!paused&&!ended&&!aborted&&offset===data.length){ended=true;if(modern)handler.onResponseEnd(controller,{});else handler.onComplete([]);}
    };
    const controller={rawHeaders,pause(){paused=true;},resume(){paused=false;pump();},abort:fail};
    Promise.resolve().then(async()=>{
      if(modern)handler.onRequestStart(controller);else handler.onConnect(fail);
      if(options.body)for await(const _ of options.body){}
      if(aborted)return;
      if(modern){handler.onResponseStarted?.(controller);handler.onResponseStart(controller,status,headers,'Fixture');}
      else handler.onHeaders(status,rawHeaders,controller.resume,'Fixture');
      pump();
    }).catch(fail);
    return true;
  }};
  return globalThis.fetch(url,{...init,dispatcher});
}
