import { esc } from './util.js';
import { sourceLink, safeUrl, openDialog } from './ui.js';
export function usableSummary(s, signals = [], now = Date.now()) {
  if (!s || s.method !== 'ai-written' || !Number.isFinite(Date.parse(s.generatedAt)) || now-Date.parse(s.generatedAt)>36*36e5 || Date.parse(s.generatedAt)>now+300000) return false;
  if (![s.windowStart,s.windowEnd].every(d=>Number.isFinite(Date.parse(d))) || Date.parse(s.windowEnd)<=Date.parse(s.windowStart) || Date.parse(s.windowEnd)>Date.parse(s.generatedAt)+300000) return false;
  const byId = new Map([...(Array.isArray(s.sources)?s.sources:[]),...signals].filter(Boolean).map(x=>[x.id,x]));
  return ['product','market','research'].every(k=> {
    const f=s.families?.[k];
    return f && Number.isInteger(f.signalCount) && f.signalCount>=0 && Array.isArray(f.sourceIds) && Array.isArray(f.bullets) && f.bullets.length && f.bullets.every(b=>typeof b==='string'&&b.trim()) && (f.signalCount===0 || (f.sourceIds?.length>0 && f.sourceIds.every(id=>byId.has(id) && safeUrl(byId.get(id).url)!=='#')));
  });
}
export function renderBrief(root, summary, signals = [], now = Date.now()) {
  if (!root) return;
  root.hidden=false;
  root.classList.remove('brief-grid');
  if(usableSummary(summary,signals,now)) {
    const byId=new Map([...(Array.isArray(summary.sources)?summary.sources:[]),...signals].map(s=>[s.id,s]));
    root.innerHTML=`<p class="brief-caption">AI-written brief · covering ${esc(new Date(summary.windowStart).toLocaleDateString('en-GB'))} to ${esc(new Date(summary.windowEnd).toISOString().slice(0,16).replace('T',' '))} UTC</p><div class="aisum-grid">${['product','market','research'].filter(k=>summary.families[k].signalCount!==0).map(k=>{const f=summary.families[k]; return `<article class="aisum-card"><div class="aisum-head"><strong>${esc(f.label||k)}</strong><span>${esc(f.signalCount)} stories</span></div><ul class="aisum-text">${f.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul><ul class="aisum-sources">${f.sourceIds.map(id=>byId.get(id)).map(s=>`<li>${sourceLink(s.url,s.title)}</li>`).join('')}</ul></article>`;}).join('')}</div>${['product','market','research'].filter(k=>summary.families[k].signalCount===0).map(k=>`<p class="aisum-empty">No ${esc(k)} stories in this brief's coverage window.</p>`).join('')}`;
    return;
  }
  const items=[...signals].filter(s=>Number.isFinite(Date.parse(s.dateISO))).sort((a,b)=>Date.parse(b.dateISO)-Date.parse(a.dateISO)).slice(0,3);
  root.innerHTML=`<p class="brief-caption">Recent source headlines · a current fully cited AI brief is not available.</p><div class="brief-grid">${items.length?items.map((s,index)=>`<article class="brief-card"><div class="brief-meta"><span>${esc(s.category||'News')}</span><time>${esc(new Date(s.dateISO).toLocaleDateString('en-GB',{day:'numeric',month:'short'}))}</time></div><h3 translate="no">${sourceLink(s.url,s.title)}</h3>${s.desc?`<p translate="no">${esc(s.desc.length>190?s.desc.slice(0,187)+'…':s.desc)}</p>`:''}<button class="story-peek" data-brief-preview="${index}">Quick look <span aria-hidden="true">↗</span></button><div class="source">${sourceLink(s.url,s.sourceName||'Original source')}</div></article>`).join(''):'<p class="empty-state">No stories in the current feed.</p>'}</div>`;
  root.querySelectorAll('[data-brief-preview]').forEach(button=>button.addEventListener('click',()=>{
    const story=items[Number(button.dataset.briefPreview)];
    openDialog('Story preview',`<p class="eyebrow">FROM THE ORIGINAL SOURCE</p><h3 translate="no">${esc(story.title)}</h3><p class="meta" translate="no">${esc(story.sourceName||'')} · ${esc(story.dateISO?.slice(0,10)||'')}</p><p class="story-full-excerpt" translate="no">${esc(story.desc||'')}</p><p class="meta">This is the publisher’s excerpt. Open the source for the complete story.</p>${sourceLink(story.url,'Read the full story')}`);
  }));

}
