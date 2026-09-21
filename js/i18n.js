import { TH } from './locales/th.js';
import { vocabTerms } from './vocab-data.js';
import { VOCAB_TH } from './locales/vocab-th.js';
import { CONTENT_TH } from './locales/content-th.js';
import { NATURAL_TH } from './locales/natural-th.js';

const normalize=value=>value.trim().replace(/\s+/g,' ');
const dictionary=new Map(Object.entries({...TH,...CONTENT_TH,...NATURAL_TH}).map(([key,value])=>[normalize(key),value]));
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
      [/^(Older snapshot|Updated|Curated)\s*·?\s*(.*)$/,(m,a,b)=>({ 'Older snapshot':'ข้อมูลก่อนหน้า','Updated':'อัปเดต','Curated':'ข้อมูลที่คัดมา' }[a])+' · '+translateText(b,'th')],
      [/^(.*?) \(MM-DD\) · Close (.*?) · Session (\d+) of (\d+)$/, (m,d,p,n,total)=>`${d} (เดือน-วัน) · ราคาปิด ${p} · ช่วงที่ ${n} จาก ${total}`],
      [/^(\d+) of (\d+) picks$/,(m,a,b)=>`${a} จาก ${b} ตัวเลือก`],
      [/^(\d+) announcements$/,(m,n)=>`${n} ประกาศ`],
      [/^(\d+) stories$/,(m,n)=>`${n} ข่าว`],
      [/^(\d+) models · (.*)$/,(m,n,u)=>`${n} โมเดล · ${u}`],
      [/^(\d+) model families · (.*) sample$/,(m,n,w)=>`${n} ตระกูลโมเดล · ตัวอย่างในช่วง ${translateText(w,'th')}`],
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
  if(!translated)translated=translateDataLabel(key);
  if(!translated && key.includes(' · ')) {
    const parts=key.split(' · ').map(part=>translateText(part,'th'));
    if(parts.join(' · ')!==key)translated=parts.join(' · ');
  }
  return translated?value.replace(/\S[\s\S]*\S|\S/,translated):value;
}

function translateDataLabel(key) {
  const patterns=[
    [/^(\d+) AI stocks across four depth layers; (\d+) curated business relationships\. Select any node to highlight its dependencies, partners and rivals\.$/,(_,n,r)=>`หุ้นที่เกี่ยวข้องกับ AI ${n} บริษัท แบ่งเป็น 4 ระดับ พร้อมความสัมพันธ์ทางธุรกิจ ${r} รายการ เลือกบริษัทเพื่อดูผู้ให้บริการที่พึ่งพา พันธมิตร และคู่แข่ง`],
    [/^recent signals? mention it · (24H|7D|30D)$/,(_,range)=>`ข่าวที่กล่าวถึงในช่วง ${translateText(range,'th')}`],
    [/^line thickness = strength · \|r\| ≥ (.*)$/,(_,r)=>`ความหนาของเส้นแสดงระดับความสัมพันธ์ · |r| ≥ ${r}`],
    [/^(\d+) pairs with a 30-day price-return correlation of \|r\| ≥ ([\d.]+)(?: — strongest: (.+) at ([+\-\d.]+))?\. Correlation ≠ causation\.$/,(_,n,r,pair,value)=>`${n} คู่ที่ผลตอบแทนราคาใน 30 วันมีความสัมพันธ์ |r| ≥ ${r}${pair?` · สูงที่สุด: ${pair} ที่ ${value}`:''} ความสัมพันธ์ไม่ได้หมายความว่าเป็นเหตุเป็นผลกัน`],
    [/^(No available|\d+) signals in (24H|7D|30D)\. (.*)$/,(_,n,range,rest)=>`${n==='No available'?'ไม่มีข้อมูล':n+' ข่าว'}ในช่วง ${translateText(range,'th')} ${translateText(rest,'th')}`],
    [/^Change from the prior window: (.*)$/,(_,n)=>`เปลี่ยนแปลงจากช่วงก่อนหน้า: ${n==='unavailable'?'ไม่มีข้อมูล':n}`],
    [/^(.+) accounts for ([\d.<>]+%) of the chatbot referrals in this snapshot\.$/,(_,name,pct)=>`${name} มีส่วนแบ่ง ${pct} ของการส่งต่อผู้เข้าชมจากแชตบอตในข้อมูลชุดนี้`],
    [/^([↑↓→]) (\d+(?:\.\d+)?)% vs (\d+)d ago$/,(_,arrow,pct,days)=>`${arrow} ${pct}% เทียบกับ ${days} วันก่อน`],
    [/^(\d+)% (stories|comments)$/,(_,n,type)=>`${type==='stories'?'ข่าว':'ความคิดเห็น'} ${n}%`],
    [/^Read on (.+)$/,(_,source)=>`อ่านต่อที่ ${source}`],
    [/^Most active now \((24H|7D|30D)\):$/,(_,range)=>`มีความเคลื่อนไหวมากที่สุด (${translateText(range,'th')}):`],
    [/^(.+): (approximately )?([\d,]+) new model\/feature discussions(, limited sample)?$/,(_,model,approx,n,limited)=>`${model}: ${approx?'ประมาณ ':''}${n} บทสนทนาเกี่ยวกับโมเดลหรือฟีเจอร์ใหม่${limited?' (ตัวอย่างมีจำกัด)':''}`],
    [/^where one exists, over (24H|7D|30D) — matched to each model AND to release\/discovery language, not a raw keyword count and not a sentiment score\. Per-model sources are shown in each panel\. Updated (.+)\.$/,(_,range,age)=>`เมื่อมีแหล่งดังกล่าว โดยดูย้อนหลัง ${translateText(range,'th')} และคัดให้ตรงทั้งชื่อโมเดลและเนื้อหาเกี่ยวกับการเปิดตัวหรือการค้นพบ ไม่ใช่แค่นับคำที่พบหรือวัดความรู้สึก แสดงแหล่งข้อมูลแยกตามโมเดล อัปเดต ${translateText(age,'th')}`],
    [/^(\d+) (min|h|d) ago$/,(_,n,unit)=>`${n} ${{min:'นาที',h:'ชั่วโมง',d:'วัน'}[unit]}ที่แล้ว`],
    [/^Last updated (.*)$/,(_,date)=>`อัปเดตล่าสุด ${date}`],
    [/^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)(.*)$/i,(_,day,month,rest)=>`${day} ${thaiMonth(month)}${rest}`],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec) (\d{1,2}) (\d{4})$/i,(_,month,day,year)=>`${day} ${thaiMonth(month)} ${year}`],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec) (\d{4})$/i,(_,month,year)=>`${thaiMonth(month)} ${year}`],
    [/^Live from (\d+) rented offers? across Vast.ai \+ RunPod$/,(_,n)=>`ข้อมูลจากข้อเสนอเช่า ${n} รายการบน Vast.ai และ RunPod`],
    [/^\((\d+) active\)$/,(_,n)=>`(ใช้ตัวกรอง ${n} รายการ)`],
    [/^Search: (.*)$/,(_,q)=>`ค้นหา: ${q}`],
    [/^Runs on (.*)$/,(_,ram)=>`ใช้ได้กับ ${ram}`],
    [/^GPU RENTAL \/ (\d+)$/,(_,n)=>`เช่า GPU / ${n}`],
    [/^(.*) parameters$/,(_,n)=>`${translateText(n,'th')} พารามิเตอร์`],
    [/^Version in this snapshot: (.*)$/,(_,n)=>`รุ่นในข้อมูลชุดนี้: ${n}`],
    [/^(Depends on|Provides infrastructure for|Partners with|Competes with) (.*)$/,(_,kind,name)=>`${({'Depends on':'พึ่งพา','Provides infrastructure for':'ให้บริการโครงสร้างพื้นฐานแก่','Partners with':'เป็นพันธมิตรกับ','Competes with':'แข่งขันกับ'})[kind]} ${name}`],
    [/^Elo ([\d,]+) · ([\d,]+) samples$/,(_,n,count)=>`Elo ${n} · ตัวอย่าง ${count} รายการ`],
    [/^(.*), closing price (.*)$/,(_,d,p)=>`${d} ราคาปิด ${p}`],
    [/^([A-Z]+) · recorded closing prices · USD$/,(_,ticker)=>`${ticker} · ราคาปิดที่บันทึกไว้ · USD`],
    [/^(.*) historical closing prices in USD\. (\d+) recorded trading sessions\. Use the slider or expand the accessible history below for exact prices\. Dates are month-day\.$/,(_,ticker,n)=>`ราคาปิดย้อนหลังของ ${ticker} หน่วย USD จำนวน ${n} วันซื้อขาย ใช้แถบเลื่อนหรือเปิดตารางด้านล่างเพื่อดูราคา วันที่แสดงเป็นเดือน-วัน`],
    [/^(\d+) days of recorded history\. (.*)$/,(_,n,rest)=>`มีข้อมูลย้อนหลัง ${n} วัน ${translateText(rest,'th')}`],
    [/^Comparing (24H|7D|30D) with the preceding window\.$/,(_,range)=>`เทียบช่วง ${translateText(range,'th')} กับช่วงก่อนหน้า`],
    [/^(.+) · (Unavailable|\d+) signals \/ (24H|7D|30D)$/,(_,layer,n,range)=>`${translateText(layer,'th')} · ${n==='Unavailable'?'ไม่มีข้อมูล':n+' ข่าว'} / ${translateText(range,'th')}`],
    [/^AI-written brief · covering (.*) to (.*) UTC$/,(_,from,to)=>`บทสรุปโดย AI · ครอบคลุม ${from} ถึง ${to} UTC`],
    [/^No (product|market|research) stories in this brief's coverage window\.$/,(_,category)=>`ไม่มีข่าว${translateText(category,'th')}ในช่วงเวลาของบทสรุปนี้`],
  ];
  for(const [pattern,replacement] of patterns)if(pattern.test(key))return key.replace(pattern,replacement);
  return null;
}
function thaiMonth(month){return ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(month.toLowerCase().slice(0,3))];}

let language='en', initialized=false;
export const getLanguage=()=>language;
export function initLanguage() {
  if(initialized)return;initialized=true;
  try{language=localStorage.getItem('ai-pulse-language')==='th'?'th':'en';}catch{}
  const label=document.createElement('label');label.className='language-picker';label.setAttribute('translate','no');
  label.innerHTML='<span class="sr-only">Language / ภาษา</span><select id="site-language" aria-label="Language / ภาษา"><option value="en">EN</option><option value="th">TH ไทย</option></select>';
  const header=document.querySelector('.site-header .wrap');header?.insertBefore(label,document.getElementById('menu-toggle'));
  const select=label.querySelector('select');select.value=language;
  const note=document.createElement('div');note.className='language-source-note';note.textContent='อ่านข่าวและข้อมูลเป็นภาษาไทย · ดูเนื้อหาต้นฉบับได้จากลิงก์แหล่งข่าว';note.setAttribute('translate','no');document.querySelector('.site-header')?.after(note);
  const texts=new WeakMap(), attributes=new WeakMap();let scheduled=false,titleRecord=null;
  const excluded='script,style,code,pre,textarea,[translate="no"],.wordmark';
  const observer=new MutationObserver(()=>schedule());
  const observe=()=>observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','aria-valuetext','title','alt']});
  function update(){
    scheduled=false;observer.disconnect();
    document.documentElement.lang=language;note.hidden=language!=='th';
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let node;while((node=walker.nextNode())){
      if(!node.parentElement||node.parentElement.closest(excluded))continue;
      let record=texts.get(node);if(!record||node.data!==record.output)record={source:node.data};
      const output=translateText(record.source,language);if(node.data!==output)node.data=output;record.output=output;texts.set(node,record);
    }
    document.querySelectorAll('[placeholder],[aria-label],[aria-valuetext],[title],[alt]').forEach(el=>{
      if(el.closest(excluded))return;
      const records=attributes.get(el)||{};
      for(const attr of ['placeholder','aria-label','aria-valuetext','title','alt'])if(el.hasAttribute(attr)){
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
