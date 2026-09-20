import { loadLatest,loadEntities,loadRanges,loadStockNetwork,loadYouTubeTrending,loadAiSummary } from './data.js';
import { initNav,getView,notifyDataReady } from './nav.js';
import { initShell } from './ui.js';
import { initModels } from './models-ui.js';
import { renderLive,renderAdoption,renderStocks,renderVideos } from './data-ui.js';
import { renderBrief } from './briefing.js';
import { renderRiver } from './river.js';
import { renderCommunity } from './community.js';
import { renderDataHealth } from './datahealth.js';
import { createStockNetwork } from './stocknetwork.js';
import { initEcosystem,updateEcosystem } from './ecosystem-ui.js';
import { snapshotLabel } from './metric-meta.js';
let data=null,entities=null,ranges=null,summary=null,net=null,stockMapCreated=false,pending=null;
const el=id=>document.getElementById(id);
initShell();initModels();initEcosystem();initNav();renderAdoption();
function notice(message){el('data-note').hidden=false;el('data-note').textContent=message;}
function paint(){if(!data)return;
 renderLive(data);renderBrief(el('ai-summary'),summary,data.signals||[]);renderRiver(el('river'),data.signals||[],Date.now(),entities?.nodes||[]);renderCommunity(el('community'),data.community||{});
 el('snapshot-pill').textContent=snapshotLabel(data.updatedAt);renderDataHealth(el('dh-chip'),el('dh-drawer'),data.dataHealth,data.build);
 el('footer-build').textContent=snapshotLabel(data.updatedAt);updateEcosystem(entities,data,ranges);renderStocks(net,data);notifyDataReady();}
function stockMap(){if(net&&!stockMapCreated&&getView()?.view==='markets'&&getView()?.mode==='network'){createStockNetwork(el('stock-network'),net);stockMapCreated=true;}}
addEventListener('app:view',stockMap);
async function latest(){try{data=await loadLatest();el('data-note').hidden=true;paint();}catch(e){console.warn('News unavailable',e);notice(data?'Refresh failed. Showing the last successful snapshot.':'News is temporarily unavailable. Curated model snapshots remain available.');if(!data){el('river').innerHTML='<p class="empty-state">Unable to load news. <button class="button" data-retry="latest">Retry news</button></p>';el('ai-summary').innerHTML='<p class="empty-state">The latest brief is unavailable.</p>';['releases','recent-releases','community'].forEach(id=>el(id).innerHTML='<p class="empty-state">This feed is unavailable. <button class="button" data-retry="latest">Retry</button></p>');el('compute-rows').innerHTML='<tr><td colspan="5">Listings are unavailable. <button class="button" data-retry="latest">Retry listings</button></td></tr>';}}}
async function entityLoad(){try{entities=await loadEntities();}catch(e){console.warn('Entities unavailable',e);}updateEcosystem(entities,data,ranges);if(data)renderRiver(el('river'),data.signals||[],Date.now(),entities?.nodes||[]);}
async function stockLoad(){net=await loadStockNetwork();renderStocks(net,data);if(!net)el('stock-network').innerHTML='<p class="empty-state">Stock connections are unavailable. <button class="button" data-retry="stocks">Retry stock connections</button></p>';else stockMap();}
async function videos(){renderVideos(await loadYouTubeTrending());}
const retries={latest,entities:entityLoad,stocks:stockLoad,videos};document.addEventListener('click',e=>{const b=e.target.closest('[data-retry]');if(b)retries[b.dataset.retry]?.();});
// Optional requests never block the main feed or curated views.
latest();entityLoad();stockLoad();videos();
loadRanges().then(r=>{ranges=r;updateEcosystem(entities,data,ranges);});
loadAiSummary().then(s=>{summary=s;if(data)renderBrief(el('ai-summary'),summary,data.signals||[]);});
el('apply-update').onclick=()=>{if(!pending)return;data=pending.data;summary=pending.summary;ranges=pending.ranges;pending=null;el('update-notice').hidden=true;paint();document.querySelector('.topsection:not([hidden]) .view-title')?.focus({preventScroll:true});};
setInterval(async()=>{try{const [fresh,newSummary,newRanges]=await Promise.all([loadLatest(),loadAiSummary(),loadRanges()]);if(fresh.updatedAt!==data?.updatedAt||newSummary?.generatedAt!==summary?.generatedAt){pending={data:fresh,summary:newSummary,ranges:newRanges};el('update-notice').hidden=false;}else{if(data){el('snapshot-pill').textContent=snapshotLabel(data.updatedAt);renderBrief(el('ai-summary'),summary,data.signals||[]);}}}catch(e){notice('Refresh failed. Showing the last successful snapshot.');}},10*60*1000);
