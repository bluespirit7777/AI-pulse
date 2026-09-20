import test from 'node:test';
import assert from 'node:assert/strict';
import { translateText } from '../js/i18n.js';
import { vocabTerms } from '../js/vocab-data.js';
import { VOCAB_TH } from '../js/locales/vocab-th.js';
import { videoId, topVideos, collectionVideos } from '../js/video-gallery.js';
import { readView, viewUrl } from '../js/view-state.js';

test('Thai translates interface copy and dynamic counts while preserving source text and numbers',()=>{
  assert.equal(translateText('  Today\n','th'),'  วันนี้\n');
  assert.equal(translateText('3 of 5 picks','th'),'3 จาก 5 ตัวเลือก');
  assert.equal(translateText('Watch on YouTube ↗','th'),'ดูบน YouTube ↗');
  assert.equal(translateText('Claude Fable 5.1','th'),'Claude Fable 5.1');
  assert.equal(translateText('A publisher headline with Today in it','th'),'A publisher headline with Today in it');
  assert.equal(translateText('Today','en'),'Today');
});
test('every glossary definition has a Thai counterpart',()=>{
  for(const entry of vocabTerms){assert.ok(VOCAB_TH[entry.term],entry.term);assert.notEqual(translateText(entry.definition,'th'),entry.definition);}
});
test('video embeds accept only valid IDs and do not trust source URLs',()=>{
  assert.equal(videoId('mvfo3pUiCCA'),'mvfo3pUiCCA');
  for(const input of ['../../evil','x" onload="a','https://youtube.com','',null])assert.equal(videoId(input),null);
});
test('video selection caps at five, deduplicates, sorts and preserves short collections',()=>{
  const rows=Array.from({length:7},(_,i)=>({videoId:`abcdefghij${i}`,viewCount:i*10,publishedAt:`2026-09-${String(20-i).padStart(2,'0')}`}));
  assert.deepEqual(topVideos([...rows,rows[6],{videoId:'invalid'}]).map(v=>v.viewCount),[60,50,40,30,20]);
  assert.equal(topVideos(rows,'recent')[0].videoId,'abcdefghij0');
  assert.equal(topVideos(rows.slice(0,4)).length,4);
  assert.deepEqual(topVideos(null),[]);
});
test('Watch is directly linkable without changing the Video model category',()=>{
  assert.equal(readView('?view=models&category=watch').category,'watch');
  assert.equal(readView('?view=models&category=video').category,'video');
  assert.equal(readView(viewUrl({view:'models',category:'watch'}).split('?')[1]).category,'watch');
});
test('short collections only borrow explicitly relevant videos inside their publication window',()=>{
  const snapshot={updatedAt:'2026-09-12T12:00:00Z',windowDays:7,models:{gpt:{videos:[]},claude:{videos:[
    {videoId:'abcdefghij0',title:'GPT-6 comparison',publishedAt:'2026-09-08',viewCount:100},
    {videoId:'abcdefghij1',title:'Claude only',publishedAt:'2026-09-08',viewCount:500},
    {videoId:'abcdefghij2',title:'ChatGPT old',publishedAt:'2026-08-01',viewCount:1000},
    {videoId:'abcdefghij3',title:'ChatGPT future',publishedAt:'2026-10-01',viewCount:1000}
  ]}}};
  assert.deepEqual(collectionVideos(snapshot,'gpt').map(v=>[v.videoId,v.relatedCollection]),[['abcdefghij0',true]]);
  snapshot.updatedAt='invalid';assert.deepEqual(collectionVideos(snapshot,'gpt'),[]);
});
