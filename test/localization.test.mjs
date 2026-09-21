import test from 'node:test';
import assert from 'node:assert/strict';
import { contentStrings } from '../scripts/lib/localization.mjs';
import { translateText } from '../js/i18n.js';
import { filterNews } from '../js/news-state.js';
import { CONTENT_TH } from '../js/locales/content-th.js';
import { parseTranslations } from '../scripts/update-translations.mjs';

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
