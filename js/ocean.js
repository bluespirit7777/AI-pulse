// One saved switch controls ocean video and decorative motion.
export function initOcean() {
 const video=document.querySelector('[data-ocean-video]'), reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let saved;try{saved=localStorage.getItem('ai-pulse-motion');}catch{}
 let wanted=!reduced.matches&&saved!=='paused';
 if(!document.querySelector('[data-wave-toggle]')){const header=document.querySelector('.site-header .wrap'),button=document.createElement('button');button.className='wave-toggle header-wave';button.dataset.waveToggle='';button.type='button';header?.insertBefore(button,document.getElementById('menu-toggle'));}
 const buttons=[...document.querySelectorAll('[data-wave-toggle]')];
 async function sync(){
  document.documentElement.dataset.motion=wanted?'on':'off';buttons.forEach(b=>{b.textContent=wanted?'Ⅱ Pause motion':'▷ Play motion';b.setAttribute('aria-pressed',String(wanted));b.setAttribute('aria-label',b.textContent);b.title=b.textContent;});dispatchEvent(new Event('app:motion'));
  if(!video)return;if(!wanted||document.hidden){video.pause();return;}
  if(!video.getAttribute('src'))video.src='assets/hero-ocean.mp4';video.muted=true;
  try{await video.play();if(!wanted||document.hidden)video.pause();}catch{}
 }
 buttons.forEach(b=>b.addEventListener('click',()=>{wanted=!wanted;try{localStorage.setItem('ai-pulse-motion',wanted?'playing':'paused');}catch{}sync();}));
 reduced.addEventListener('change',()=>{wanted=!reduced.matches;try{if(localStorage.getItem('ai-pulse-motion')==='paused')wanted=false;}catch{}sync();});
 document.addEventListener('visibilitychange',()=>{document.documentElement.classList.toggle('page-idle',document.hidden);sync();});sync();
}
