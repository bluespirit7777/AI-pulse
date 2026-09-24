import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contentStrings } from '../scripts/lib/localization.mjs';
import { translateText } from '../js/i18n.js';
import { filterNews } from '../js/news-state.js';
import { CONTENT_TH } from '../js/locales/content-th.js';
import { parseGeminiTranslations, selectTranslationProvider, translateBatch } from '../scripts/update-translations.mjs';

test('all current reader-facing data has a Thai translation and an unchanged English original',async()=>{
  for(const source of await contentStrings()){
    assert.match(CONTENT_TH[source],/[\u0E00-\u0E7F]/u,source);
    assert.equal(translateText(source,'en'),source);
    assert.equal(translateText(source,'th'),CONTENT_TH[source]);
  }
});
test('Thai news search intersects category and entity filters without mutating data',()=>{
  const signals=[{title:'Researchers used Claude to hack OpenAI',desc:'Researchers used Claude to reach an OpenAI employee account and sensitive GitHub data.',category:'research',entityIds:['claude']},{title:'Researchers used Claude to hack OpenAI',category:'general',entityIds:['gpt']}];
  const original=JSON.stringify(signals);
  const result=filterNews(signals,{q:'นักวิจัยใช้ Claude',category:'research',entity:'claude'});
  assert.ok(result.length);
  assert.ok(result.every(s=>s.category==='research'&&s.entityIds.includes('claude')));
  assert.equal(JSON.stringify(signals),original);
  assert.ok(filterNews(signals,{q:'Researchers used Claude'}).length);
});
test('translated data labels preserve amounts, dates and proper names',()=>{
  assert.equal(translateText('20 Sept 2026, 15:45 UTC','th'),'20 ก.ย. 2026, 15:45 UTC');
  assert.equal(translateText('Live from 42 rented offers across Vast.ai + RunPod','th'),'ข้อมูลจากข้อเสนอเช่า 42 รายการบน Vast.ai และ RunPod');
  assert.equal(translateText('3 h ago','th'),'3 ชั่วโมงที่แล้ว');
  for(const s of ['Claude Fable 5.1','$222.27','+1.34%','NVDA','https://example.com'])assert.equal(translateText(s,'th'),s);
});
test('Gemini translation batches accept only complete Thai structured output',()=>{
  const response=(translations,finishReason='STOP')=>({candidates:[{finishReason,content:{parts:[{text:JSON.stringify({translations})}]}}]});
  const malformed={candidates:[{finishReason:'STOP',content:{parts:[{text:'not-json'}]}}]};
  assert.deepEqual(parseGeminiTranslations(response(['ข่าวใหม่']),1),['ข่าวใหม่']);
  for(const r of [response([]),response(['Still English']),response(['ข่าว'],'MAX_TOKENS'),{},malformed])assert.throws(()=>parseGeminiTranslations(r,1));
});
test('translation provider is Gemini-only and uses the current model by default',()=>{
  assert.deepEqual(selectTranslationProvider({GEMINI_API_KEY:'gemini-test',OPENAI_API_KEY:'openai-test'}),{name:'gemini',apiKey:'gemini-test',model:'gemini-3.8-flash'});
  assert.deepEqual(selectTranslationProvider({GEMINI_API_KEY:'gemini-test',GEMINI_TRANSLATION_MODEL:'gemini-custom',OPENAI_API_KEY:'openai-test'}),{name:'gemini',apiKey:'gemini-test',model:'gemini-custom'});
  assert.throws(()=>selectTranslationProvider({OPENAI_API_KEY:'openai-test'}),/GEMINI_API_KEY/);
  assert.throws(()=>selectTranslationProvider({}),/GEMINI_API_KEY/);
});
test('translation workflows only wire Gemini provider credentials and model variables',async()=>{
  for(const name of ['update-data.yml','update-youtube.yml']){
    const workflow=await readFile(new URL(`../.github/workflows/${name}`,import.meta.url),'utf8');
    assert.ok(workflow.includes('GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}'));
    assert.ok(workflow.includes('GEMINI_TRANSLATION_MODEL: ${{ vars.GEMINI_TRANSLATION_MODEL }}'));
    assert.ok(!workflow.includes('OPENAI_API_KEY'));
    assert.ok(!workflow.includes('OPENAI_TRANSLATION_MODEL'));
    assert.ok(!workflow.includes('api.openai.com'));
  }
});
test('Gemini translation provider sends a structured request and returns validated rows',async()=>{
  let request;
  const fakeFetch=async(url,options)=>{
    request={url,options};
    return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({translations:['ข่าวใหม่']})}]}}]})};
  };
  assert.deepEqual(await translateBatch(['New story'],{name:'gemini',apiKey:'secret',model:'gemini-3.8-flash'},fakeFetch),['ข่าวใหม่']);
  assert.equal(request.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
  assert.equal(request.options.headers['x-goog-api-key'],'secret');
  const body=JSON.parse(request.options.body);
  assert.equal(body.generationConfig.responseMimeType,'application/json');
  assert.deepEqual(JSON.parse(body.contents[0].parts[0].text),['New story']);
});
test('translation batch rejects OpenAI providers before making a request',async()=>{
  let requests=0;
  await assert.rejects(translateBatch(['New story'],{name:'openai',apiKey:'openai-test'},async()=>{
    requests++;
    return {ok:false,status:400};
  }),/Unsupported translation provider/);
  assert.equal(requests,0);
});
test('translation retries a transient server error and then returns validated translations',async()=>{
  let requests=0;
  const delays=[];
  const fakeFetch=async()=>{
    requests++;
    if(requests===1)return {ok:false,status:503};
    return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({translations:['ข่าวใหม่']})}]}}]})};
  };
  const result=await translateBatch(['New story'],{name:'gemini',apiKey:'secret',model:'gemini-test'},fakeFetch,{sleepImpl:async ms=>delays.push(ms)});
  assert.deepEqual(result,['ข่าวใหม่']);
  assert.equal(requests,2);
  assert.deepEqual(delays,[1000]);
});

test('translation honors Retry-After for rate-limited provider responses',async()=>{
  let requests=0;
  const delays=[];
  const fakeFetch=async()=>{
    requests++;
    if(requests===1)return {ok:false,status:429,headers:{get:name=>name.toLowerCase()==='retry-after'?'2':null}};
    return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({translations:['ข่าวใหม่']})}]}}]})};
  };
  await translateBatch(['New story'],{name:'gemini',apiKey:'secret',model:'gemini-test'},fakeFetch,{sleepImpl:async ms=>delays.push(ms)});
  assert.equal(requests,2);
  assert.deepEqual(delays,[2000]);
});

test('translation retries transient fetch failures but not permanent HTTP errors',async()=>{
  let networkRequests=0;
  const delays=[];
  const networkFetch=async()=>{
    networkRequests++;
    if(networkRequests===1)throw new TypeError('fetch failed');
    return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({translations:['ข่าวใหม่']})}]}}]})};
  };
  await translateBatch(['New story'],{name:'gemini',apiKey:'secret',model:'gemini-test'},networkFetch,{sleepImpl:async ms=>delays.push(ms)});
  assert.equal(networkRequests,2);
  assert.deepEqual(delays,[1000]);

  let permanentRequests=0;
  await assert.rejects(translateBatch(['New story'],{name:'gemini',apiKey:'secret',model:'gemini-test'},async()=>{
    permanentRequests++;
    return {ok:false,status:401};
  },{sleepImpl:async()=>assert.fail('permanent errors must not be retried')}),/HTTP 401/);
  assert.equal(permanentRequests,1);
});

test('translation stops after four transient failures without publishing a partial result',async()=>{
  let requests=0;
  const delays=[];
  await assert.rejects(translateBatch(['New story'],{name:'gemini',apiKey:'secret',model:'gemini-test'},async()=>{
    requests++;
    return {ok:false,status:503};
  },{sleepImpl:async ms=>delays.push(ms)}),/HTTP 503/);
  assert.equal(requests,4);
  assert.deepEqual(delays,[1000,2000,4000]);
});
