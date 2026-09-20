import { TH } from './locales/th.js';
import { vocabTerms } from './vocab-data.js';
import { VOCAB_TH } from './locales/vocab-th.js';

const normalize=value=>value.trim().replace(/\s+/g,' ');
const dictionary=new Map(Object.entries(TH).map(([key,value])=>[normalize(key),value]));
for(const term of vocabTerms)if(VOCAB_TH[term.term])dictionary.set(normalize(term.definition),VOCAB_TH[term.term]);
export function translateText(value, language='en') {
  if(language!=='th'||typeof value!=='string'||!value.trim())return value;
  const key=normalize(value);let translated=dictionary.get(key);
  if(!translated){
    const arrow=key.match(/^(.*?)\s*([↗→↓↑])$/u);
    if(arrow&&dictionary.has(arrow[1].trim()))translated=dictionary.get(arrow[1].trim())+' '+arrow[2];
  }
  if(!translated){
    const patterns=[
      [/^(Older snapshot|Updated|Curated)\s*·?\s*(.*)$/,(m,a,b)=>({ 'Older snapshot':'ข้อมูลย้อนหลัง','Updated':'อัปเดต','Curated':'ข้อมูลคัดสรร' }[a])+' · '+b.replace(/(\d+)-day publication window before collection/, 'เผยแพร่ในช่วง $1 วันก่อนเก็บข้อมูล')],
      [/^(.*?) \(MM-DD\) · Close (.*?) · Session (\d+) of (\d+)$/, (m,d,p,n,total)=>`${d} (เดือน-วัน) · ราคาปิด ${p} · ช่วงที่ ${n} จาก ${total}`],
      [/^(\d+) of (\d+) picks$/,(m,a,b)=>`${a} จาก ${b} ตัวเลือก`],
      [/^(\d+) announcements$/,(m,n)=>`${n} ประกาศ`],
      [/^(\d+) stories$/,(m,n)=>`${n} ข่าว`],
      [/^(\d+) models · (.*)$/,(m,n,u)=>`${n} โมเดล · ${u}`],
      [/^(\d+) model families · (.*) sample$/,(m,n,w)=>`${n} ตระกูลโมเดล · ตัวอย่าง ${w}`],
      [/^(\d+) of (\d+) stories(.*)$/,(m,n,total,rest)=>`${n} จาก ${total} ข่าว${rest.replace('loaded coverage','ช่วงข้อมูล')}`],
      [/^Show (\d+) more$/,(m,n)=>`แสดงอีก ${n} รายการ`],
      [/^(\d+) of 3 selected$/,(m,n)=>`เลือกแล้ว ${n} จาก 3 โมเดล`],
      [/^Data Health · (.*) feeds$/,(m,n)=>`สถานะข้อมูล · ${n} แหล่งข้อมูล`],
      [/^(.*?) · AI Pulse$/,(m,title)=>translateText(title,'th')+' · AI Pulse'],
      [/^(\d+)-day publication window before collection$/,(m,n)=>`เผยแพร่ในช่วง ${n} วันก่อนเก็บข้อมูล`],
      [/^Details for (.+)$/,(m,n)=>`รายละเอียด ${n}`],
      [/^Compare (.+)$/,(m,n)=>`เปรียบเทียบ ${n}`]
    ];
    for(const [pattern,replacement] of patterns)if(pattern.test(key)){translated=key.replace(pattern,replacement);break;}
  }
  return translated?value.replace(/\S[\s\S]*\S|\S/,translated):value;
}

let language='en', initialized=false;
export const getLanguage=()=>language;
export function initLanguage() {
  if(initialized)return;initialized=true;
  try{language=localStorage.getItem('ai-pulse-language')==='th'?'th':'en';}catch{}
  const label=document.createElement('label');label.className='language-picker';label.setAttribute('translate','no');
  label.innerHTML='<span class="sr-only">Language / ภาษา</span><select id="site-language" aria-label="Language / ภาษา"><option value="en">EN</option><option value="th">TH ไทย</option></select>';
  const header=document.querySelector('.site-header .wrap');header?.insertBefore(label,document.getElementById('menu-toggle'));
  const select=label.querySelector('select');select.value=language;
  const note=document.createElement('div');note.className='language-source-note';note.textContent='เมนูและคำอธิบายเป็นภาษาไทย · พาดหัวข่าว ชื่อโมเดล และเนื้อหาจากแหล่งข่าวคงภาษาต้นฉบับ';note.setAttribute('translate','no');document.querySelector('.site-header')?.after(note);
  const texts=new WeakMap(), attributes=new WeakMap();let scheduled=false,titleRecord=null;
  const excluded='script,style,code,pre,textarea,[translate="no"],.wordmark';
  const observer=new MutationObserver(()=>schedule());
  const observe=()=>observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
  function update(){
    scheduled=false;observer.disconnect();
    document.documentElement.lang=language;note.hidden=language!=='th';
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let node;while((node=walker.nextNode())){
      if(!node.parentElement||node.parentElement.closest(excluded))continue;
      let record=texts.get(node);if(!record||node.data!==record.output)record={source:node.data};
      const output=translateText(record.source,language);if(node.data!==output)node.data=output;record.output=output;texts.set(node,record);
    }
    document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el=>{
      if(el.closest(excluded))return;
      const records=attributes.get(el)||{};
      for(const attr of ['placeholder','aria-label','title'])if(el.hasAttribute(attr)){
        const current=el.getAttribute(attr);let record=records[attr];if(!record||current!==record.output)record={source:current};const output=translateText(record.source,language);if(current!==output)el.setAttribute(attr,output);record.output=output;records[attr]=record;
      }
      attributes.set(el,records);
    });
    if(!titleRecord||document.title!==titleRecord.output)titleRecord={source:document.title};titleRecord.output=translateText(titleRecord.source,language);document.title=titleRecord.output;
    observe();
  }
  function schedule(){if(!scheduled){scheduled=true;queueMicrotask(update);}}
  select.addEventListener('change',()=>{language=select.value==='th'?'th':'en';try{localStorage.setItem('ai-pulse-language',language);}catch{}update();dispatchEvent(new CustomEvent('app:language',{detail:{language}}));});
  addEventListener('app:view',schedule);addEventListener('app:data-ready',schedule);update();
}
