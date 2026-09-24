import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contentStrings } from '../scripts/lib/localization.mjs';
import { translateText } from '../js/i18n.js';
import { filterNews } from '../js/news-state.js';
import { CONTENT_TH } from '../js/locales/content-th.js';
import { parseTranslations, parseGeminiTranslations, selectTranslationProvider, translateBatch } from '../scripts/update-translations.mjs';

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
test('translation batches reject partial, malformed and untranslated responses',()=>{
  const response=(translations,status='completed')=>({status,output:[{type:'reasoning'},{content:[{type:'output_text',text:JSON.stringify({translations})}]}]});
  assert.deepEqual(parseTranslations(response(['ข่าวใหม่']),1),['ข่าวใหม่']);
  for(const r of [response([]),response(['Still English']),response(['ข่าว'],'incomplete')])assert.throws(()=>parseTranslations(r,1));
});
test('Gemini translation batches accept only complete Thai structured output',()=>{
  const response=(translations,finishReason='STOP')=>({candidates:[{finishReason,content:{parts:[{text:JSON.stringify({translations})}]}}]});
  const malformed={candidates:[{finishReason:'STOP',content:{parts:[{text:'not-json'}]}}]};
  assert.deepEqual(parseGeminiTranslations(response(['ข่าวใหม่']),1),['ข่าวใหม่']);
  for(const r of [response([]),response(['Still English']),response(['ข่าว'],'MAX_TOKENS'),{},malformed])assert.throws(()=>parseGeminiTranslations(r,1));
});
test('translation provider keeps model overrides scoped to the selected provider',()=>{
  assert.deepEqual(selectTranslationProvider({GEMINI_API_KEY:'gemini-test',TRANSLATION_MODEL:'gpt-5.5'}),{name:'gemini',apiKey:'gemini-test',model:'gemini-3.1-flash-lite'});
  assert.deepEqual(selectTranslationProvider({GEMINI_API_KEY:'gemini-test',GEMINI_TRANSLATION_MODEL:'gemini-custom'}),{name:'gemini',apiKey:'gemini-test',model:'gemini-custom'});
  assert.deepEqual(selectTranslationProvider({OPENAI_API_KEY:'openai-test',GEMINI_API_KEY:'gemini-test',OPENAI_TRANSLATION_MODEL:'openai-custom',GEMINI_TRANSLATION_MODEL:'gemini-custom'}),{name:'openai',apiKey:'openai-test',model:'openai-custom'});
  assert.deepEqual(selectTranslationProvider({OPENAI_API_KEY:'openai-test',TRANSLATION_MODEL:'gemini-3.1-flash-lite'}),{name:'openai',apiKey:'openai-test',model:'gpt-5.5'});
  assert.throws(()=>selectTranslationProvider({}),/OPENAI_API_KEY or GEMINI_API_KEY/);
});
test('translation workflows expose provider-specific model variables',async()=>{
  for(const name of ['update-data.yml','update-youtube.yml']){
    const workflow=await readFile(new URL(`../.github/workflows/${name}`,import.meta.url),'utf8');
    assert.match(workflow,/OPENAI_TRANSLATION_MODEL: \$\{\{ vars\.OPENAI_TRANSLATION_MODEL \}\}/);
    assert.match(workflow,/GEMINI_TRANSLATION_MODEL: \$\{\{ vars\.GEMINI_TRANSLATION_MODEL \}\}/);
    assert.doesNotMatch(workflow,/^\s+TRANSLATION_MODEL:/m);
  }
});
test('Gemini translation provider sends a structured request and returns validated rows',async()=>{
  let request;
  const fakeFetch=async(url,options)=>{
    request={url,options};
    return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({translations:['ข่าวใหม่']})}]}}]})};
  };
  assert.deepEqual(await translateBatch(['New story'],{name:'gemini',apiKey:'secret',model:'gemini-3.5-flash'},fakeFetch),['ข่าวใหม่']);
  assert.equal(request.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent');
  assert.equal(request.options.headers['x-goog-api-key'],'secret');
  const body=JSON.parse(request.options.body);
  assert.equal(body.generationConfig.responseMimeType,'application/json');
  assert.deepEqual(JSON.parse(body.contents[0].parts[0].text),['New story']);
});
test('OpenAI translation provider preserves Responses API structured output behavior',async()=>{
  let request;
  const fakeFetch=async(url,options)=>{
    request={url,options};
    return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({translations:['ข่าวใหม่']})}]}]})};
  };
  assert.deepEqual(await translateBatch(['New story'],{name:'openai',apiKey:'secret',model:'gpt-test'},fakeFetch),['ข่าวใหม่']);
  assert.equal(request.url,'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.Authorization,'Bearer secret');
  const body=JSON.parse(request.options.body);
  assert.equal(body.model,'gpt-test');
  assert.equal(body.store,false);
  assert.equal(body.text.format.type,'json_schema');
  assert.deepEqual(JSON.parse(body.input),['New story']);
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
