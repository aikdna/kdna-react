import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMatrix } from './matrix.mjs';
import { api, publicClient, makeDriver } from './node-driver.mjs';
test('fresh React consumer through actual isolated Host HTTP',async()=>{
 assert(process.env.KDNA_TEST_ORIGIN,'KDNA_TEST_ORIGIN_REQUIRED');
 const result=await runMatrix(api,makeDriver,process.env.KDNA_TEST_ORIGIN,publicClient);
 console.log('REACT_MATRIX '+JSON.stringify(result));
 assert.equal(result.failed,0,JSON.stringify(result.rows.filter(x=>!x.pass)));
});
