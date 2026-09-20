// Visible content remains usable even if animation APIs are unavailable.
export function initMotion() {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'), fine=matchMedia('(hover: hover) and (pointer: fine)');
  const enabled=()=>document.documentElement.dataset.motion!=='off'&&!reduced.matches;
  const targets='.brief-card,.aisum-card,.compute-card,.task-grid>a,.video-card,.current-note,.rank-dashboard,.today-compass,.market-workspace';
  const seen=new WeakSet();
  const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(!isIntersecting)return;observer.unobserve(target);if(enabled())target.animate([{opacity:.3,translate:'0 18px'},{opacity:1,translate:'0 0'}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'});}),{threshold:.08});
  function scan(root){if(root.nodeType!==1)return;[...(root.matches(targets)?[root]:[]),...root.querySelectorAll(targets)].forEach(node=>{if(!seen.has(node)){seen.add(node);observer.observe(node);}});}
  scan(document.body);new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(scan))).observe(document.body,{childList:true,subtree:true});
  let frame=0,card=null;
  document.addEventListener('pointermove',e=>{if(!enabled()||!fine.matches)return;const next=e.target.closest('.video-card,.compute-card,.task-grid>a,.current-note');if(card&&card!==next){card.style.removeProperty('--tilt-x');card.style.removeProperty('--tilt-y');}card=next;if(!card)return;cancelAnimationFrame(frame);const x=e.clientX,y=e.clientY,target=card;frame=requestAnimationFrame(()=>{const r=target.getBoundingClientRect();target.style.setProperty('--tilt-x',((y-r.top)/r.height-.5)*-4+'deg');target.style.setProperty('--tilt-y',((x-r.left)/r.width-.5)*4+'deg');});},{passive:true});
  document.addEventListener('pointerout',e=>{if(card&&!card.contains(e.relatedTarget)){card.style.removeProperty('--tilt-x');card.style.removeProperty('--tilt-y');card=null;}},{passive:true});
  document.addEventListener('click',e=>{const target=e.target.closest('.button,.video-card,[data-ticker]');if(!target||!enabled())return;const rect=target.getBoundingClientRect(),ripple=document.createElement('span');ripple.className='tap-ripple';ripple.setAttribute('aria-hidden','true');ripple.style.left=(e.detail?e.clientX-rect.left:rect.width/2)+'px';ripple.style.top=(e.detail?e.clientY-rect.top:rect.height/2)+'px';target.classList.add('ripple-host');target.append(ripple);setTimeout(()=>ripple.remove(),700);});
  addEventListener('app:view',()=>{const panel=document.querySelector('.topsection:not([hidden])');if(enabled()&&panel)panel.animate([{opacity:.5,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:320,easing:'ease-out'});});
  addEventListener('app:motion',()=>{if(!enabled()){cancelAnimationFrame(frame);document.getAnimations().forEach(a=>a.cancel());}});
}
