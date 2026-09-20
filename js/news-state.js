export const NEWS_CATEGORIES=['product','research','capital','market','compute','policy','opensource','adoption','orggov','analysis','general'];
export function readNews(search='') { const p=new URLSearchParams(search);return {q:(p.get('q')||'').slice(0,200),category:NEWS_CATEGORIES.includes(p.get('filter'))?p.get('filter'):'',entity:(p.get('entity')||'').slice(0,80),days:['1','7','30'].includes(p.get('days'))?p.get('days'):''}; }
export function filterNews(signals,state,entities=[],now=Date.now()) {
 const alias=new Map(entities.map(e=>[e.id,[e.name,e.org,...(e.match||[])].join(' ')]));
 return signals.filter(s=>{
  const entitiesText=(s.entityIds||[]).map(id=>alias.get(id)||id).join(' ');
  const text=[s.title,s.desc,s.sourceName,s.category,entitiesText].join(' ').toLowerCase();
  return (!state.q||text.includes(state.q.trim().toLowerCase()))&&(!state.category||s.category===state.category)&&(!state.entity||(s.entityIds||[]).includes(state.entity))&&(!state.days||(Number.isFinite(Date.parse(s.dateISO))&&Date.parse(s.dateISO)>=now-Number(state.days)*864e5));
 }).sort((a,b)=>(Date.parse(b.dateISO)||0)-(Date.parse(a.dateISO)||0));
}
