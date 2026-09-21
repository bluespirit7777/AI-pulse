import { esc } from './util.js';
import { sourceLink } from './ui.js';
import { freshnessChip } from './freshness.js';
import { filterNews,readNews,NEWS_CATEGORIES } from './news-state.js';
const controllers=new WeakMap();
export function renderRiver(root,signals=[],now=Date.now(),entities=[]) {
 if(!root)return;
 if(controllers.has(root)){controllers.get(root).update(signals,now,entities);return;}
 let data=signals,clock=now,nodes=entities,state=readNews(location.search),visible=12,timer;
 root.innerHTML=`<div class="news-search"><label>Search news<input type="search" id="news-query" maxlength="200" placeholder="Try Claude, chips, or research" value="${esc(state.q)}"></label><button class="button quiet" id="clear-search">Clear search</button></div><details id="news-filters"><summary>Filters <span id="filter-count"></span></summary><div class="filter-controls"><label>Category<select id="news-category"><option value="">All categories</option>${NEWS_CATEGORIES.map(c=>`<option value="${c}">${c==='opensource'?'Open source':c==='orggov'?'Organizations':c[0].toUpperCase()+c.slice(1)}</option>`).join('')}</select></label><label>Organization or model<select id="news-entity"></select></label><label>Published within<select id="news-days"><option value="">Entire loaded feed</option><option value="1">24 hours</option><option value="7">7 days</option><option value="30">30 days</option></select></label></div></details><div class="active-filters" id="active-filters"></div><p class="meta" id="news-count" role="status"></p><ol class="news-list"></ol><button class="button quiet" id="news-more" hidden>Show 12 more</button>`;
 const query=root.querySelector('#news-query'),cat=root.querySelector('#news-category'),entity=root.querySelector('#news-entity'),days=root.querySelector('#news-days'),more=root.querySelector('#news-more');
 function options(){const ids=new Set(data.flatMap(s=>s.entityIds||[]));entity.innerHTML='<option value="">All organizations & models</option>'+[...ids].sort().map(id=>`<option value="${esc(id)}">${esc(nodes.find(n=>n.id===id)?.name||id)}</option>`).join('');if(!ids.has(state.entity))state.entity='';}
 function url(){const u=new URL(location.href);['q','filter','entity','days'].forEach(k=>u.searchParams.delete(k));for(const [k,v]of Object.entries({q:state.q,filter:state.category,entity:state.entity,days:state.days}))if(v)u.searchParams.set(k,v);history.replaceState(null,'',u.pathname+u.search+u.hash);}
 function draw(){cat.value=state.category;entity.value=state.entity;days.value=state.days;const found=filterNews(data,state,nodes,clock),count=Object.values(state).filter(Boolean).length;root.querySelector('#filter-count').textContent=count?`(${count} active)`:'';root.querySelector('#active-filters').innerHTML=Object.entries(state).filter(([,v])=>v).map(([k,v])=>`<button class="button quiet" data-clear="${k}">${esc(k==='q'?'Search: '+v:v)} ×</button>`).join('');const dates=data.map(s=>Date.parse(s.dateISO)).filter(Number.isFinite);root.querySelector('#news-count').textContent=`${found.length} of ${data.length} stories`+(dates.length?` · loaded coverage ${new Date(Math.min(...dates)).toLocaleDateString('en-GB')}–${new Date(Math.max(...dates)).toLocaleDateString('en-GB')}`:'');
 root.querySelector('.news-list').innerHTML=found.length?found.slice(0,visible).map(s=>`<li class="news-item"><div class="news-meta"><span>${esc(s.category||'News')}</span>${freshnessChip(s.dateISO,clock)}<span>${esc(s.sourceName||'Original source')}</span></div><h3>${sourceLink(s.url,s.title)}</h3>${s.desc?`<p>${esc(s.desc)}</p>`:''}</li>`).join(''):`<li class="empty-state">${data.length?'No stories match these filters.':'No stories in the current feed.'} <button class="button" data-reset>Clear filters & search</button></li>`;
 more.hidden=found.length<=visible;more.textContent=`Show ${Math.min(12,Math.max(0,found.length-visible))} more`;}
 function changed(){visible=12;url();draw();}
 query.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{state.q=query.value;changed();},200);});
 cat.onchange=()=>{state.category=cat.value;changed();};entity.onchange=()=>{state.entity=entity.value;changed();};days.onchange=()=>{state.days=days.value;changed();};
 root.querySelector('#clear-search').onclick=()=>{clearTimeout(timer);query.value='';state.q='';changed();query.focus();};
 root.addEventListener('click',e=>{const b=e.target.closest('[data-clear],[data-reset]');if(!b)return;clearTimeout(timer);if(b.hasAttribute('data-reset'))state={q:'',category:'',entity:'',days:''};else state[b.dataset.clear]='';query.value=state.q;changed();query.focus();});
 more.onclick=()=>{const firstNew=visible;visible+=12;draw();root.querySelectorAll('.news-item h3 a')[firstNew]?.focus({preventScroll:true});};
 addEventListener('app:view',()=>{state=readNews(location.search);query.value=state.q;options();draw();});
 controllers.set(root,{update(s,n,e){data=s;clock=n;nodes=e;options();draw();}});options();draw();
}
