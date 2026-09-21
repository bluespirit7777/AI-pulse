import { esc } from './util.js';
import { openDialog } from './ui.js';
import { snapshotLabel } from './metric-meta.js';

export const VIDEO_FAMILIES = [['claude','Claude'],['gpt','ChatGPT'],['gemini','Gemini']];
export function videoId(value) { return typeof value === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(value) ? value : null; }
export function topVideos(videos = [], sort = 'views') {
  const unique = new Map();
  for (const v of (Array.isArray(videos)?videos:[])) if (v && videoId(v.videoId) && !unique.has(v.videoId)) unique.set(v.videoId,v);
  return [...unique.values()].sort((a,b)=>sort==='recent'?(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0):(b.viewCount??-1)-(a.viewCount??-1)).slice(0,5);
}
function duration(seconds) { if(!Number.isFinite(seconds))return '';const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=Math.floor(seconds%60);return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`; }
// Fill a short family collection only with explicitly matching, dated videos
// already collected for another family in the same publication window.
export function collectionVideos(snapshot, key) {
  const primary=topVideos(snapshot?.models?.[key]?.videos);
  if(primary.length>=5)return primary;
  const end=Date.parse(snapshot?.models?.[key]?.updatedAt||snapshot?.updatedAt);
  if(!Number.isFinite(end))return primary;
  const start=end-(Number(snapshot.windowDays)||7)*864e5;
  const match={claude:/\bclaude\b/i,gpt:/\bchatgpt\b|\bgpt[-\s]?\d/i,gemini:/\bgemini\b/i}[key];
  if(!match)return primary;
  const ids=new Set(primary.map(v=>v.videoId));
  const candidates=Object.entries(snapshot.models||{}).filter(([family])=>family!==key).flatMap(([,model])=>Array.isArray(model.videos)?model.videos:[]).filter(v=>v&&videoId(v.videoId)&&!ids.has(v.videoId)&&match.test(v.title||'')&&Date.parse(v.publishedAt)>=start&&Date.parse(v.publishedAt)<=end);
  const additions=topVideos(candidates).map(v=>({...v,relatedCollection:true}));
  return topVideos([...primary,...additions]);
}
let family='claude', selected=0, sort='views';
export function renderVideos(snapshot) {
  const root=document.getElementById('release-videos');if(!root)return;
  if(!snapshot){root.innerHTML='<p class="empty-state">Videos are unavailable this cycle. <button class="button" data-retry="videos">Retry videos</button></p>';return;}
  root.innerHTML=`<div class="video-gallery"><div class="rank-toolbar"><div><h2>The viewing room</h2><span class="rank-count">Top 5 per model</span></div><label class="rank-sort">Sort videos<select id="video-sort"><option value="views">Most viewed</option><option value="recent">Newest in collection</option></select></label></div><div class="video-family-tabs" role="tablist" aria-label="Choose a model’s videos">${VIDEO_FAMILIES.map(([id,label])=>`<button role="tab" id="watch-${id}" data-video-family="${id}" aria-controls="video-panel" aria-selected="${id===family}" tabindex="${id===family?'0':'-1'}"><span translate="no">${label}</span><small>${collectionVideos(snapshot,id).length} / 5</small></button>`).join('')}</div><div id="video-panel" role="tabpanel" aria-labelledby="watch-${family}"></div><div class="video-disclosure"><span>Video audio stays in its original language.</span><span>Ranked within the collected results, not all of YouTube.</span></div></div>`;
  const panel=root.querySelector('#video-panel'),tabs=[...root.querySelectorAll('[data-video-family]')];
  function play(v) {
    openDialog('Watch video',`<div class="video-player"><iframe title="YouTube video player" src="https://www.youtube-nocookie.com/embed/${videoId(v.videoId)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><h3 class="video-dialog-title">${esc(v.title)}</h3><p class="meta" translate="no">${esc(v.channelTitle||'YouTube')}</p><p class="meta">If playback is unavailable here, open the original video.</p><a class="button primary" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${videoId(v.videoId)}">Watch on YouTube ↗</a>`);
    document.getElementById('detail-dialog').addEventListener('close',()=>document.querySelector('#detail-dialog iframe')?.remove(),{once:true});
  }
  function draw() {
    const model=snapshot.models?.[family], videos=topVideos(collectionVideos(snapshot,family),sort);selected=Math.min(selected,Math.max(0,videos.length-1));
    panel.setAttribute('aria-labelledby','watch-'+family);
    const v=videos[selected];
    panel.innerHTML=`<p class="video-collection-date">${esc(snapshotLabel(model?.updatedAt||snapshot.updatedAt))} · ${esc(snapshot.windowDays||7)}-day publication window before collection</p>${v?`<div class="video-feature"><button class="video-screen" data-play-feature aria-label="Play selected video"><img src="https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg" alt="" decoding="async"><span class="video-screen-shade"></span><span class="video-play" aria-hidden="true">▶</span><span class="video-screen-label">Click to play</span><span class="video-duration" translate="no">${duration(v.durationSeconds)}</span></button><div class="video-feature-copy"><p class="eyebrow">SELECTED FOR YOUR CURIOSITY</p><span class="video-channel" translate="no">${esc(v.channelTitle||'YouTube')}</span><h3>${esc(v.title)}</h3><p class="video-stats"><span translate="no">${Number.isFinite(v.viewCount)?v.viewCount.toLocaleString():'—'}</span> <span>views at collection</span> · <time translate="no">${esc(v.publishedAt?.slice(0,10)||'—')}</time></p><p class="video-description">${esc(v.description||'')}</p><button class="button primary" data-play-feature>Play video ↗</button></div></div>${videos.some(item=>item.relatedCollection)?'<p class="video-supplement">Includes a related video from another model’s collection in the same publication window.</p>':''}<div class="video-queue-head"><p class="eyebrow">YOUR WATCHLIST</p><span class="meta">Select a card to preview</span></div><div class="video-queue" role="group" aria-label="Videos in this collection">${videos.map((item,i)=>`<button class="video-card" data-video-index="${i}" aria-pressed="${selected===i}"><span class="video-card-image"><img src="https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg" loading="lazy" decoding="async" alt=""><span class="video-card-index">${String(i+1).padStart(2,'0')}</span><span class="video-duration" translate="no">${duration(item.durationSeconds)}</span></span><strong>${esc(item.title)}</strong><small translate="no">${esc(item.channelTitle||'YouTube')}</small>${item.relatedCollection?'<span class="video-related">Related collection</span>':''}</button>`).join('')}</div>${videos.length<5?'<p class="video-shortfall">Fewer than five qualifying videos are available in this snapshot.</p>':''}`:'<p class="empty-state">No videos for this model in the current snapshot.</p>'}`;
    panel.querySelectorAll('[data-play-feature]').forEach(b=>b.onclick=()=>play(v));
    panel.querySelectorAll('[data-video-index]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.videoIndex);draw();panel.querySelector(`[data-video-index="${selected}"]`)?.focus({preventScroll:true});});
    panel.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;img.parentElement.classList.add('thumbnail-missing');},{once:true}));
  }
  function select(button){family=button.dataset.videoFamily;selected=0;tabs.forEach(t=>{t.setAttribute('aria-selected',String(t===button));t.tabIndex=t===button?0:-1;});draw();}
  tabs.forEach((t,i)=>{t.onclick=()=>select(t);t.onkeydown=e=>{const next=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(next!==null){e.preventDefault();tabs[next].focus();select(tabs[next]);}};});
  root.querySelector('#video-sort').value=sort;root.querySelector('#video-sort').onchange=e=>{sort=e.target.value;selected=0;draw();};draw();
}
