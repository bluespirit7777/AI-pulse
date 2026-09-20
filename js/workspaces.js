import { esc } from './util.js';
import { sourceLink } from './ui.js';
import { snapshotLabel } from './metric-meta.js';

let releaseFilter = '';
export function renderReleaseDesk(releases, updatedAt) {
  const root = document.getElementById('releases');
  const all = releases.flatMap(r => r.items.map(item => ({...item, lab:r.lab}))).sort((a,b) => (Date.parse(b.d)||0)-(Date.parse(a.d)||0));
  if (!releases.some(r => r.lab === releaseFilter)) releaseFilter = '';
  root.innerHTML = `<div class="rank-dashboard release-workspace"><div class="rank-toolbar"><div><h2>The release log</h2><span class="rank-count">Models & features</span></div><span class="rank-count">${esc(snapshotLabel(updatedAt))}</span></div><div class="release-layout"><aside class="release-sidebar"><p class="rank-guide-label">FOLLOW A LAB</p><div class="release-filters" role="group" aria-label="Filter releases by lab">${[['', 'All labs', all.length],...releases.map(r=>[r.lab,r.lab,r.items.length])].map(([key,label,count])=>`<button data-release-lab="${esc(key)}" aria-pressed="${key===releaseFilter}"><span>${esc(label)}</span><b>${count}</b></button>`).join('')}</div><div class="release-guide"><p class="rank-guide-label">FROM ANNOUNCEMENT TO CONTEXT</p><h3>What’s new.<br>What changed.</h3><p>Qualifying announcements from the collected snapshot. Open the source to explore the release in full.</p><small>Up to five releases per provider. Collection dates are not release dates.</small></div></aside><div class="release-main"><div class="release-heading"><h3>New arrivals</h3><span id="release-count" role="status"></span></div><ol class="release-timeline"></ol></div></div></div>`;
  function draw() {
    const items = all.filter(r=>!releaseFilter||r.lab===releaseFilter);
    root.querySelectorAll('[data-release-lab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.releaseLab===releaseFilter)));
    root.querySelector('#release-count').textContent=`${items.length} announcements`;
    root.querySelector('.release-timeline').innerHTML=items.length?items.map(i=>`<li><div class="release-date">${esc(i.d)}</div><div class="release-entry"><span class="release-lab">${esc(i.lab)}</span><h3>${sourceLink(i.url,i.h)}</h3><div class="release-source">${esc(i.sourceName||i.lab)}${i.videoUrl?sourceLink(i.videoUrl,'Watch the launch'):''}</div></div></li>`).join(''):'<li class="empty-state">No qualifying releases in this snapshot.</li>';
  }
  root.querySelectorAll('[data-release-lab]').forEach(b=>b.onclick=()=>{releaseFilter=b.dataset.releaseLab;draw();});draw();
}

export function renderTodayOverview(data, releases) {
  const root=document.getElementById('today-overview');
  if(!root) return;
  const signals=data.signals||[], sources=new Set(signals.map(s=>s.sourceName).filter(Boolean));
  const topics=[['product','Tools & products'],['research','Research'],['opensource','Open source']];
  root.innerHTML=`<div class="today-compass"><div class="compass-intro"><p class="eyebrow">YOUR READING COMPASS</p><h2>Catch the signal.<br><em>Keep your perspective.</em></h2><p>Start with the brief, follow a topic, or explore recent model releases.</p><div class="compass-jumps"><button data-jump="ai-summary">The briefing ↓</button><button data-jump="sec-recent">New releases ↓</button><button data-jump="sec-waves">Full feed ↓</button></div></div><div class="compass-data"><p class="eyebrow">IN THE LOADED SNAPSHOT</p><div class="snapshot-metrics"><div><strong>${signals.length}</strong><span>stories</span></div><div><strong>${sources.size}</strong><span>named sources</span></div><div><strong>${releases.reduce((n,r)=>n+r.items.length,0)}</strong><span>releases</span></div></div><div class="topic-shortcuts"><span>Follow a topic</span>${topics.map(([key,label])=>`<button data-topic="${key}">${label} <span aria-hidden="true">↗</span></button>`).join('')}</div><small>Counts describe this snapshot, not everything happening in AI.</small></div></div>`;
  const jump=id=>document.getElementById(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  root.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jump(b.dataset.jump));
  root.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{
    const control=document.getElementById('news-category');
    if(control){control.value=b.dataset.topic;control.dispatchEvent(new Event('change',{bubbles:true}));jump('sec-waves');document.getElementById('news-query')?.focus({preventScroll:true});}
  });
}

let selectedTicker=null, priceObserver=null;
const dollars=n=>Number.isFinite(n)?'$'+n.toFixed(2):'Not available';
const change=n=>Number.isFinite(n)?(n>0?'+':'')+n.toFixed(2)+'%':'Not available';
export function renderMarketSpotlight(nodes, updatedAt) {
  const root=document.getElementById('market-spotlight');
  if(!root)return;
  priceObserver?.disconnect();
  if(!nodes.length){root.innerHTML='';return;}
  if(!nodes.some(n=>n.t===selectedTicker))selectedTicker=nodes[0].t;
  root.innerHTML=`<div class="market-workspace"><div class="market-watch"><p class="eyebrow">FOLLOW THE INFRASTRUCTURE</p><h2>The companies<br>behind the current.</h2><p class="market-instruction">Select a company to explore its price history.</p><div class="ticker-list" role="group" aria-label="Select a company">${nodes.map(n=>`<button data-ticker="${esc(n.t)}" aria-pressed="${n.t===selectedTicker}"><span><strong>${esc(n.t)}</strong><small>${esc(n.layer||'AI ecosystem')}</small></span><span class="${n.changePct<0?'negative':'positive'}">${esc(change(n.changePct))}</span></button>`).join('')}</div><p class="market-watch-note">Change from the last two available trading bars. Not a live quote.</p></div><div class="market-detail"><div id="market-company" aria-live="polite" aria-atomic="true"></div><div class="price-chart-wrap"><canvas id="price-chart" role="img"></canvas></div><p id="price-readout" class="price-readout" role="status"></p><label class="price-scrubber">Explore a trading session<input type="range" id="price-session" min="0" value="0" aria-describedby="price-readout"></label><details class="price-history"><summary>View accessible price history</summary><div class="price-history-table"></div></details><p class="market-source">${esc(snapshotLabel(updatedAt))} · Yahoo Finance · USD</p></div></div>`;
  const canvas=root.querySelector('canvas'), slider=root.querySelector('#price-session');
  let series=[],active=0;
  function drawChart(){
    const width=canvas.clientWidth,height=240,dpr=window.devicePixelRatio||1;
    if(!width)return;
    canvas.width=width*dpr;canvas.height=height*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    if(series.length<2){ctx.fillStyle='#56766f';ctx.font='14px sans-serif';ctx.fillText('Not enough price history to draw a chart.',18,110);return;}
    const low=Math.min(...series.map(p=>p.c)),high=Math.max(...series.map(p=>p.c)),pad=Math.max((high-low)*.12,high*.005,1),min=low-pad,max=high+pad;
    const left=12,right=width-65,top=15,bottom=210;
    const x=i=>left+(right-left)*i/(series.length-1),y=n=>bottom-(n-min)/(max-min)*(bottom-top);
    ctx.font='11px sans-serif';
    for(let i=0;i<4;i++){const value=min+(max-min)*i/3,yy=y(value);ctx.strokeStyle='#d9e5dc';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();ctx.fillStyle='#5a796d';ctx.fillText('$'+value.toFixed(0),right+10,yy+4);}
    const gradient=ctx.createLinearGradient(0,top,0,bottom);gradient.addColorStop(0,'#6fae9055');gradient.addColorStop(1,'#6fae9000');ctx.beginPath();series.forEach((p,i)=>i?ctx.lineTo(x(i),y(p.c)):ctx.moveTo(x(i),y(p.c)));ctx.lineTo(x(series.length-1),bottom);ctx.lineTo(left,bottom);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
    ctx.beginPath();series.forEach((p,i)=>i?ctx.lineTo(x(i),y(p.c)):ctx.moveTo(x(i),y(p.c)));ctx.strokeStyle='#347d6c';ctx.lineWidth=2.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(x(active),top);ctx.lineTo(x(active),bottom);ctx.strokeStyle='#8dafa2';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(x(active),y(series[active].c),4,0,Math.PI*2);ctx.fillStyle='#155b4c';ctx.fill();ctx.fillStyle='#5a796d';ctx.fillText(series[0].d,left,233);ctx.fillText(series.at(-1).d,Math.max(left,right-35),233);
  }
  function readout(){const p=series[active];root.querySelector('#price-readout').textContent=p?`${p.d} (MM-DD) · Close ${dollars(p.c)} · Session ${active+1} of ${series.length}`:'No recorded closing prices for this company.';slider.setAttribute('aria-valuetext',p?`${p.d}, closing price ${dollars(p.c)}`:'No history');drawChart();}
  function select(ticker){
    selectedTicker=ticker;const n=nodes.find(n=>n.t===ticker);
    root.querySelectorAll('[data-ticker]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ticker===ticker)));
    series=(n.chart||n.ohlc||[]).filter(p=>p && Number.isFinite(p.c)&&typeof p.d==='string');active=Math.max(0,series.length-1);
    root.querySelector('#market-company').innerHTML=`<div class="market-company-top"><span class="market-sector">${esc(n.layer||'AI ecosystem')} / ${esc(n.t)}</span>${sourceLink(n.url||'https://finance.yahoo.com/quote/'+encodeURIComponent(n.t),'Quote source')}</div><h3>${esc(n.n||n.name||n.t)}</h3><div class="market-price"><strong>${dollars(n.price)}</strong><span class="${n.changePct<0?'negative':'positive'}">${esc(change(n.changePct))}<small>last trading-bar change${n.changeReview?' · review unusual move':''}</small></span></div><p class="market-context">${esc(n.signal||'Explore the recorded price history and source for this company.')}</p>`;
    canvas.setAttribute('aria-label',`${n.t} historical closing prices in USD. ${series.length} recorded trading sessions. Use the slider or expand the accessible history below for exact prices. Dates are month-day.`);
    slider.max=Math.max(0,series.length-1);slider.value=active;slider.disabled=!series.length;
    root.querySelector('.price-history-table').innerHTML=series.length?`<table><caption>${esc(n.t)} · recorded closing prices · USD</caption><thead><tr><th scope="col">Session (MM-DD)</th><th scope="col">Close</th></tr></thead><tbody>${series.map(p=>`<tr><th scope="row">${esc(p.d)}</th><td>${dollars(p.c)}</td></tr>`).join('')}</tbody></table>`:'<p>No price history available.</p>';
    readout();
  }
  root.querySelectorAll('[data-ticker]').forEach(b=>b.onclick=()=>select(b.dataset.ticker));slider.oninput=()=>{active=Number(slider.value);readout();};
  canvas.onpointermove=e=>{if(series.length<2)return;active=Math.max(0,Math.min(series.length-1,Math.round((e.offsetX-12)/(canvas.clientWidth-77)*(series.length-1))));slider.value=active;readout();};
  priceObserver=new ResizeObserver(drawChart);priceObserver.observe(canvas);select(selectedTicker);
}
