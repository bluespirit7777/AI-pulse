import { loadLatest, loadAiSummary } from './data.js';
import { leaderboardOverall, imageAI, videoAI, localAI, CURATED_ASOF } from './curated.js';
import { renderBrief } from './briefing.js';
import { snapshotLabel } from './metric-meta.js';
import { initShell, openDialog } from './ui.js';
import { esc } from './util.js';
import { initDiscovery } from './discovery.js';
initShell();
initDiscovery();
const sets={text:leaderboardOverall,image:imageAI,video:videoAI,local:localAI};
const descriptions={text:'Artificial Analysis Intelligence Index · a composite of evaluated capabilities.',image:'Image Arena Elo · relative preference in head-to-head comparisons.',video:'Video Arena Elo · relative preference within this evaluation.',local:'Editorial hardware-fit picks · these are not measured quality rankings.'};
function select(category) {
 document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===category;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
 const data=sets[category].slice(0,5), max=Math.max(...data.map(m=>m.score||0));
 document.getElementById('lp-models').innerHTML=`<ol class="leader-preview">${data.map((m,i)=>`<li><button data-preview="${i}" aria-label="Details for ${esc(m.model)}"><span class="preview-rank">${String(i+1).padStart(2,'0')}</span><span><span class="leader-name">${esc(m.model)}</span><small>${esc(m.org)}</small>${m.score!=null?`<span class="leader-track" aria-hidden="true"><span class="leader-fill" style="--score:${max?m.score/max*100:0}%"></span></span>`:''}</span><span class="leader-result">${esc(m.score!=null?m.score:'Fit')}<small>${esc(m.scoreUnit||m.stat)}</small></span></button></li>`).join('')}</ol>`;
 document.querySelectorAll('[data-preview]').forEach(button=>button.onclick=()=>{const model=data[Number(button.dataset.preview)];openDialog(model.model,`<p class="meta">${esc(model.org)} · curated ${esc(CURATED_ASOF)}</p><p>${esc(model.note)}</p><p>${esc(descriptions[category])}</p><a class="button primary" href="app.html?view=models&category=${category}">Open full comparison →</a>`);});
 document.getElementById('lp-model-context').textContent=descriptions[category]+(category==='local'?' ':' Bars relative to this list’s leader. ')+' Curated · '+CURATED_ASOF;
 document.getElementById('lp-model-link').href='app.html?view=models&category='+category;
}
const tabs=[...document.querySelectorAll('[data-tab]')];
tabs.forEach((b,i)=>{b.addEventListener('click',()=>select(b.dataset.tab));b.addEventListener('keydown',e=>{const next=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(next!==null){e.preventDefault();tabs[next].focus();select(tabs[next].dataset.tab);}});});
select('text');
async function load() {
 const root=document.getElementById('lp-brief');
 try { const [d,s]=await Promise.all([loadLatest(),loadAiSummary()]);renderBrief(root,s,d.signals||[]);document.getElementById('lp-snapshot').textContent=snapshotLabel(d.updatedAt); }
 catch(e){root.innerHTML='<p class="empty-state">News is temporarily unavailable. You can still explore model snapshots. <button class="button" id="lp-retry">Retry news</button></p>';document.getElementById('lp-retry').onclick=load;}
}
load();
