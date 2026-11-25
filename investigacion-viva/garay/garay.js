import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

const client=createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
 'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',
 {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const DOSSIER='garay';
const MAX_CHAPTERS=999;
const ACTIVITY_DAYS=14;
const PARTS=['I','II','III','IV','V'];
const STATUSES=[['por-revisar','Por revisar'],['por-limpiar','Por limpiar'],['corregido','Corregido'],['final','Final']];
const STATUS_NAMES=Object.fromEntries(STATUSES);
const $=id=>document.getElementById(id);
const mk=(tag,cls,txt)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(txt!==undefined)node.textContent=txt;return node;};
let owner=null,chapters=[],baseChapters=[],state=empty(),saveTimer=null,saveQueue=Promise.resolve(),generation=0;
function empty(){return {version:3,partRanges:{},chapterCount:0,chapterStatus:{},chapterNotes:{},chapterEdited:{},chapterCorrectedAt:{},chapterFinalAt:{}};}
function validChapterNumber(num){return /^[0-9]{1,3}$/.test(num)&&Number(num)>=1&&Number(num)<=MAX_CHAPTERS;}
function normalise(value,baseCount=0){
 const result=empty();
 if(!value||typeof value!=='object'){result.chapterCount=baseCount;return result;}
 for(const [num,status] of Object.entries(value.chapterStatus||{})){
  if(validChapterNumber(num)&&STATUS_NAMES[status])result.chapterStatus[num]=status;
 }
 for(const [num,note] of Object.entries(value.chapterNotes||{})){
  if(validChapterNumber(num)&&typeof note==='string')result.chapterNotes[num]=note.slice(0,10000);
 }
 for(const [num,date] of Object.entries(value.chapterEdited||{})){
  if(validChapterNumber(num)&&typeof date==='string')result.chapterEdited[num]=date.slice(0,35);
 }
 for(const [num,date] of Object.entries(value.chapterCorrectedAt||{})){
  if(validChapterNumber(num)&&typeof date==='string')result.chapterCorrectedAt[num]=date.slice(0,35);
 }
 for(const [num,date] of Object.entries(value.chapterFinalAt||{})){
  if(validChapterNumber(num)&&typeof date==='string')result.chapterFinalAt[num]=date.slice(0,35);
 }
 const observed=Object.keys({...result.chapterStatus,...result.chapterNotes,...result.chapterEdited,...result.chapterCorrectedAt,...result.chapterFinalAt})
  .map(Number).filter(Number.isFinite);
 const observedMax=observed.length?Math.max(...observed):0;
 const requested=Number.isInteger(value.chapterCount)?value.chapterCount:0;
 result.chapterCount=Math.min(MAX_CHAPTERS,Math.max(baseCount,observedMax,requested));
 // Preserve old progress and accept only valid, ordered, non-overlapping ranges.
 result.partRanges=normaliseRanges(value.partRanges,result.chapterCount);
 return result;
}
function normaliseRanges(raw,total){
 const out={};let last=0;
 for(const part of PARTS){
  const r=raw?.[part];
  if(r&&Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.start>last&&r.end>=r.start&&r.end<=total){
   out[part]={start:r.start,end:r.end};last=r.end;
  }
 }
 return out;
}
function partOf(num){
 return PARTS.find(p=>{const r=state.partRanges[p];return r&&num>=r.start&&num<=r.end;})||'none';
}
function buildChapters(){
 const byNumber=new Map(baseChapters.map(c=>[c.number,c]));
 chapters=Array.from({length:state.chapterCount},(_,i)=>{
  const number=i+1;
  return byNumber.get(number)||{number,title:'Capítulo '+number};
 });
 updateChapterLabels();
 for(const input of document.querySelectorAll('#garay-parts input'))input.max=state.chapterCount;
}
function updateChapterLabels(){
 const n=chapters.length;
 if($('hero-chapter-count'))$('hero-chapter-count').textContent=n;
 if($('chapter-heading-total'))$('chapter-heading-total').textContent=n;
 if($('chapter-total-control'))$('chapter-total-control').textContent=n;
}
function gate(message=''){
 ++generation;clearTimeout(saveTimer);owner=null;chapters=[];baseChapters=[];state=empty();
 $('loading-state').hidden=true;$('private-app').hidden=true;$('gate').hidden=false;
 $('chapter-list').replaceChildren();$('footer-state').textContent='Acceso restringido';
 $('login-error').textContent=message;
}
function status(num){return state.chapterStatus[num]||'por-revisar';}
function countStatuses(){
 const counts=Object.fromEntries(STATUSES.map(([value])=>[value,0]));
 for(const c of chapters)counts[status(c.number)]++;
 return counts;
}
function updateStats(){
 const n=chapters.length||1,counts=countStatuses(),ready=counts.corregido+counts.final;
 $('count-review').textContent=counts['por-revisar'];
 $('count-clean').textContent=counts['por-limpiar'];
 $('count-corrected').textContent=counts.corregido;
 $('count-final').textContent=counts.final;
 $('ready-count').replaceChildren(document.createTextNode(ready+' '),mk('small','','/ '+n));
 $('ready-fill').style.width=(ready/n*100)+'%';
 $('ready-percent').textContent=(ready/n*100).toFixed(1).replace('.',',')+' % del total';
 $('final-count').textContent=counts.final+' / '+n;
 $('final-fill').style.width=(counts.final/n*100)+'%';
 updatePartStats();
}
function save(delay=350){
 if(!owner)return;
 clearTimeout(saveTimer);
 $('garay-sync').textContent='Guardando cambios…';
 const current=generation,uid=owner.id;
 saveTimer=setTimeout(()=>{
  const snapshot=structuredClone(state);
  saveQueue=saveQueue.then(async()=>{
   if(current!==generation)return;
   const {error}=await client.from('iv_progress').upsert({
    owner_id:uid,dossier_slug:DOSSIER,data:snapshot,updated_at:new Date().toISOString()
   },{onConflict:'owner_id,dossier_slug'});
   if(error)throw error;
   if(current===generation)$('garay-sync').textContent='Cambios sincronizados con tu cuenta.';
  }).catch(error=>{
   console.warn('Garay: error al guardar el progreso',error);
   if(current===generation)$('garay-sync').textContent='No se pudo guardar. Revisá la conexión antes de salir.';
  });
 },delay);
}
function touch(num,iso=new Date().toISOString()){state.chapterEdited[num]=iso;}
function registerMilestones(num,newStatus,iso=new Date().toISOString()){
 if((newStatus==='corregido'||newStatus==='final')&&!state.chapterCorrectedAt[num])state.chapterCorrectedAt[num]=iso;
 if(newStatus==='final'&&!state.chapterFinalAt[num])state.chapterFinalAt[num]=iso;
}
function migrateMilestones(){
 let changed=false;
 for(const c of chapters){
  const num=c.number,current=status(num),stamp=state.chapterEdited[num];
  if(!stamp)continue;
  if((current==='corregido'||current==='final')&&!state.chapterCorrectedAt[num]){state.chapterCorrectedAt[num]=stamp;changed=true;}
  if(current==='final'&&!state.chapterFinalAt[num]){state.chapterFinalAt[num]=stamp;changed=true;}
 }
 return changed;
}
function dayKey(date){
 const d=date instanceof Date?date:new Date(date);
 if(Number.isNaN(d.getTime()))return '';
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function recentDays(count){
 const now=new Date();now.setHours(12,0,0,0);
 return Array.from({length:count},(_,i)=>{
  const date=new Date(now);date.setDate(now.getDate()-(count-1-i));
  return {key:dayKey(date),date};
 });
}
function milestoneCounts(source,days){
 const allowed=new Set(days.map(d=>d.key)),counts=Object.fromEntries(days.map(d=>[d.key,0]));
 for(const value of Object.values(source)){
  const key=dayKey(value);
  if(allowed.has(key))counts[key]++;
 }
 return counts;
}
function updateActivity(){
 const days=recentDays(ACTIVITY_DAYS);
 const corrected=milestoneCounts(state.chapterCorrectedAt,days);
 const finalised=milestoneCounts(state.chapterFinalAt,days);
 const today=days.at(-1).key,last7=days.slice(-7).map(d=>d.key);
 $('today-corrected').textContent=corrected[today]||0;
 $('today-final').textContent=finalised[today]||0;
 $('week-corrected').textContent=last7.reduce((sum,key)=>sum+(corrected[key]||0),0);
 $('week-final').textContent=last7.reduce((sum,key)=>sum+(finalised[key]||0),0);
 const max=Math.max(1,...days.flatMap(d=>[corrected[d.key]||0,finalised[d.key]||0]));
 const chart=$('activity-chart');chart.replaceChildren();
 const fmt=new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'2-digit'});
 for(const {key,date} of days){
  const group=mk('div','garay-chart-day');
  const bars=mk('div','garay-chart-bars');
  const a=mk('span','garay-bar garay-bar-corrected');
  const b=mk('span','garay-bar garay-bar-final');
  const ca=corrected[key]||0,fb=finalised[key]||0;
  a.style.setProperty('--bar-height',(ca/max*100)+'%');
  b.style.setProperty('--bar-height',(fb/max*100)+'%');
  a.title=ca+' corregido'+(ca===1?'':'s')+' · '+fmt.format(date);
  b.title=fb+' final'+(fb===1?'':'es')+' · '+fmt.format(date);
  bars.append(a,b);
  const values=mk('small','garay-chart-values',ca+' · '+fb);
  const label=mk('span','garay-chart-label',fmt.format(date));
  group.append(bars,values,label);chart.append(group);
 }
 const known=Object.keys(state.chapterCorrectedAt).length+Object.keys(state.chapterFinalAt).length;
 $('activity-note').textContent=known?'Cada columna muestra corregidos · finales. Los hitos se cuentan una sola vez por capítulo.':'El historial empezará a dibujarse cuando marques capítulos como «Corregido» o «Final».';
}
function matches(c){
 const partFilter=$('chapter-part-filter').value;
 if(partFilter!=='all'&&partFilter!==partOf(c.number))return false;
 const filter=$('chapter-filter').value;
 if(filter!=='all'&&filter!==status(c.number))return false;
 const q=$('chapter-search').value.toLowerCase().trim();
 if(!q)return true;
 const note=state.chapterNotes[c.number]||'';
 return ('capítulo '+c.number+' '+c.number+' '+note).toLowerCase().includes(q);
}
function render(){
 const root=$('chapter-list');root.replaceChildren();
 const list=chapters.filter(matches);
 for(const p of [...PARTS,'none'])$('part-stat-'+p)?.setAttribute('aria-pressed',String($('chapter-part-filter').value===p));
 $('chapter-results').textContent=list.length+' de '+chapters.length+' capítulos';
 if(!list.length){root.append(mk('p','garay-empty','No hay capítulos que coincidan con este filtro.'));return;}
 let previous=null;
 for(const c of list){
  const num=c.number,part=partOf(num);
  if(part!==previous){
   const heading=mk('h3','garay-part-heading',part==='none'?'Sin asignar':'Parte '+part);
   root.append(heading);previous=part;
  }
  const article=mk('article','garay-chapter');article.id='cap-'+num;article.dataset.status=status(num);
  const row=mk('div','garay-chapter-row');
  const number=mk('span','garay-number',String(num).padStart(3,'0'));
  const main=mk('div','garay-chapter-main');
  main.append(mk('strong','',c.title||'Capítulo '+num));
  const note=state.chapterNotes[num]||'';
  const sub=mk('small','',note?'Con observaciones guardadas':'Sin notas editoriales');
  main.append(sub);
  const select=mk('select');
  select.setAttribute('aria-label','Estado del capítulo '+num);
  for(const [value,label] of STATUSES){const opt=mk('option','',label);opt.value=value;select.append(opt);}
  select.value=status(num);
  select.addEventListener('change',()=>{
   const iso=new Date().toISOString();
   state.chapterStatus[num]=select.value;touch(num,iso);registerMilestones(num,select.value,iso);save();updateStats();updateActivity();
   article.dataset.status=select.value;
   if($('chapter-filter').value!=='all')render();
  });
  const detail=mk('button','garay-detail-toggle',note?'Ver notas ▾':'Agregar nota ▾');
  detail.type='button';
  detail.setAttribute('aria-expanded','false');
  const notePanel=mk('div','garay-chapter-notes');notePanel.hidden=true;
  const label=mk('label','','Observaciones editoriales · capítulo '+num);
  const textarea=mk('textarea');textarea.maxLength=10000;textarea.rows=3;
  textarea.placeholder='Repeticiones, ritmo, continuidad, estilo, limpieza, decisiones pendientes…';
  textarea.value=note;
  const noteHint=mk('small','','Se guarda automáticamente en tu cuenta.');
  textarea.addEventListener('input',()=>{
   state.chapterNotes[num]=textarea.value;touch(num);save();
   sub.textContent=textarea.value?'Con observaciones guardadas':'Sin notas editoriales';
   detail.textContent=textarea.value?'Ver notas ▴':'Cerrar notas ▴';
  });
  label.append(textarea);notePanel.append(label,noteHint);
  detail.addEventListener('click',()=>{
   notePanel.hidden=!notePanel.hidden;
   const isOpen=!notePanel.hidden;
   detail.setAttribute('aria-expanded',String(isOpen));
   detail.textContent=isOpen?'Cerrar notas ▴':((state.chapterNotes[num]||'')?'Ver notas ▾':'Agregar nota ▾');
   if(isOpen)textarea.focus();
  });
  row.append(number,main,select,detail);article.append(row,notePanel);root.append(article);
 }
}
function addChapters(amount){
 const count=Math.max(1,Math.min(50,Number(amount)||1));
 if(state.chapterCount+count>MAX_CHAPTERS){$('garay-sync').textContent='El tablero admite hasta '+MAX_CHAPTERS+' capítulos.';return;}
 state.chapterCount+=count;$('chapter-part-filter').value='all';$('chapter-filter').value='all';$('chapter-search').value='';buildChapters();save(0);updateStats();updateActivity();render();
 $('garay-sync').textContent='Se agregaron '+count+' capítulo'+(count===1?'':'s')+'.';
 const first=state.chapterCount-count+1;
 requestAnimationFrame(()=>document.getElementById('cap-'+first)?.scrollIntoView({behavior:'smooth',block:'center'}));
}
async function load(){
 const gen=++generation;
 $('loading-state').hidden=false;$('gate').hidden=true;$('private-app').hidden=true;
 const auth=await client.auth.getUser();
 if(gen!==generation)return;
 if(auth.error||!auth.data.user){gate();return;}
 const user=auth.data.user;
 const dossier=await client.from('iv_dossiers').select('title,catalog').eq('slug',DOSSIER).single();
 if(gen!==generation)return;
 if(dossier.error||!Array.isArray(dossier.data?.catalog)){gate('No se pudo abrir el proyecto privado.');return;}
 const list=dossier.data.catalog
  .filter(x=>Number.isInteger(x?.number)&&x.number>=1&&x.number<=MAX_CHAPTERS)
  .sort((a,b)=>a.number-b.number);
 if(!list.length||new Set(list.map(x=>x.number)).size!==list.length){gate('El catálogo base de capítulos no es válido.');return;}
 const baseCount=Math.max(...list.map(x=>x.number));
 const progress=await client.from('iv_progress').select('data').eq('owner_id',user.id).eq('dossier_slug',DOSSIER).maybeSingle();
 if(gen!==generation)return;
 if(progress.error){gate('No se pudieron cargar los estados editoriales.');return;}
 owner=user;baseChapters=list;state=normalise(progress.data?.data,baseCount);buildChapters();
 const migrated=migrateMilestones();
 $('loading-state').hidden=true;$('gate').hidden=true;$('private-app').hidden=false;
 $('footer-state').textContent='Cuenta autorizada';
 $('garay-sync').textContent='Progreso privado sincronizado.';
 fillPartForm();$('chapter-part-filter').value='all';updateStats();updateActivity();render();
 if(migrated)save(0);
}
function updatePartStats(){
 for(const part of [...PARTS,'none']){
  const list=chapters.filter(c=>partOf(c.number)===part);
  const ready=list.filter(c=>['corregido','final'].includes(status(c.number))).length;
  const final=list.filter(c=>status(c.number)==='final').length;
  const el=$('part-stat-'+part);
  if(!el)continue;
  el.querySelector('small').textContent=list.length?ready+' / '+list.length+' corregidos o finales · '+final+' finales':(part==='none'?'Ningún capítulo':'Sin definir');
  el.querySelector('.garay-meter>div').style.width=(list.length?100*ready/list.length:0)+'%';
 }
}
function fillPartForm(){
 for(const p of PARTS){
  const r=state.partRanges[p];
  $('part-start-'+p).value=r?.start??'';
  $('part-end-'+p).value=r?.end??'';
 }
 $('part-error').textContent='';
}
function installParts(){
 const style=mk('style');style.textContent=
 '#garay-parts{margin:20px 0;padding:20px;border:1px solid var(--line);background:var(--white)}.garay-part-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:12px 0 16px}.garay-part-card{display:grid;gap:8px;text-align:left;background:transparent;border:1px solid var(--line);padding:10px;color:var(--deep);cursor:pointer}.garay-part-card strong{font:18px var(--serif)}.garay-part-card small{font:10px/1.4 var(--sans);color:var(--muted)}.garay-part-card[aria-pressed=true]{border-color:var(--sage);background:#eef1e9}.garay-part-heading{font:400 22px var(--serif);margin:18px 0 4px;color:var(--deep);border-bottom:1px solid var(--line);padding-bottom:6px}.garay-part-range{display:grid;grid-template-columns:90px minmax(80px,150px) minmax(80px,150px);align-items:end;gap:10px;margin:8px 0}.garay-part-range label{font:10px var(--sans);color:var(--muted)}.garay-part-range input{display:block;width:100%;margin-top:4px}.garay-part-config summary{cursor:pointer;color:var(--deep);font:600 12px var(--sans)}.garay-part-config p{font:12px/1.5 var(--sans);color:var(--muted)}.garay-part-config form{margin-top:12px}.garay-part-config .garay-outline{margin-top:8px}.garay-filterbar{grid-template-columns:minmax(120px,1fr) minmax(115px,170px) minmax(115px,170px) auto}@media(max-width:950px){.garay-filterbar{grid-template-columns:1fr 1fr}}@media(max-width:640px){.garay-filterbar{grid-template-columns:1fr}.garay-part-range{grid-template-columns:70px 1fr 1fr}}';
 document.head.append(style);
 const box=mk('section');box.id='garay-parts';box.setAttribute('aria-label','Partes de la novela');
 box.append(mk('h3','garay-part-heading','Las cinco partes'));
 const summary=mk('div','garay-part-summary');
 const filter=mk('select');filter.id='chapter-part-filter';
 for(const p of ['all',...PARTS,'none']){
  const label=p==='all'?'Todas las partes':p==='none'?'Sin asignar':'Parte '+p;
  const opt=mk('option','',label);opt.value=p;filter.append(opt);
  if(p==='all')continue;
  const btn=mk('button','garay-part-card');btn.type='button';btn.id='part-stat-'+p;btn.setAttribute('aria-pressed','false');
  const meter=mk('div','garay-meter');meter.append(mk('div'));
  btn.append(mk('strong','',label),mk('small','','—'),meter);
  btn.addEventListener('click',()=>{filter.value=filter.value===p?'all':p;render();});
  summary.append(btn);
 }
 const details=mk('details','garay-part-config');
 details.append(mk('summary','','Configurar los capítulos de cada parte'),mk('p','','Indicá el primer y el último capítulo de cada parte. Dejá ambos vacíos si todavía no conocés el rango. Los rangos deben seguir el orden de la novela y no superponerse.'));
 const form=mk('form');
 for(const p of PARTS){
  const row=mk('div','garay-part-range');row.append(mk('strong','','Parte '+p));
  for(const [key,label] of [['start','Desde'],['end','Hasta']]){
   const l=mk('label','',label),input=mk('input');input.type='number';input.min=1;input.step=1;input.max=MAX_CHAPTERS;input.id='part-'+key+'-'+p;l.append(input);row.append(l);
  }
  form.append(row);
 }
 const submit=mk('button','garay-outline','Guardar división');submit.type='submit';
 const error=mk('p','error');error.id='part-error';error.setAttribute('role','status');
 form.append(submit,error);details.append(form);box.append(summary,details);
 const bar=document.querySelector('.garay-filterbar');bar.before(box);
 const label=mk('label','','Filtrar por parte');label.append(filter);bar.insertBefore(label,$('next-review'));
 filter.addEventListener('change',render);
 form.addEventListener('submit',event=>{
  event.preventDefault();const ranges={};let last=0;
  for(const p of PARTS){
   const a=$('part-start-'+p).value,b=$('part-end-'+p).value;
   if(!a&&!b)continue;
   const start=Number(a),end=Number(b);
   if(!a||!b||!Number.isInteger(start)||!Number.isInteger(end)||start<=last||end<start||end>state.chapterCount){
    error.textContent='Revisá el rango de la parte '+p+': debe ser completo, estar ordenado y quedar dentro del total de capítulos.';return;
   }
   ranges[p]={start,end};last=end;
  }
  state.partRanges=ranges;save(0);updatePartStats();render();error.textContent='División actualizada.';
 });
}
installParts();
$('chapter-search').addEventListener('input',render);
$('chapter-filter').addEventListener('change',render);
$('next-review').addEventListener('click',()=>{
 $('chapter-search').value='';$('chapter-filter').value='all';render();
 $('chapter-part-filter').value='all';render();
 const next=chapters.find(c=>status(c.number)==='por-revisar');
 if(next)document.getElementById('cap-'+next.number)?.scrollIntoView({behavior:'smooth',block:'center'});
 else $('garay-sync').textContent='No quedan capítulos en «Por revisar».';
});
$('add-chapters-form').addEventListener('submit',event=>{
 event.preventDefault();
 const input=$('add-chapters-count');addChapters(input.value);input.value='1';
});
$('login-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const btn=$('login-form').querySelector('button');btn.disabled=true;
 $('login-error').textContent='';
 try{
  const {error}=await client.auth.signInWithPassword({
   email:$('login-email').value.trim(),password:$('login-password').value
  });
  if(error)throw error;
  $('login-password').value='';await load();
 }catch(err){
  console.warn('Garay: error de inicio de sesión',err);
  $('login-error').textContent='No se pudo iniciar sesión. Revisá tus datos.';
 }finally{btn.disabled=false;}
});
client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')gate();});
window.addEventListener('pageshow',event=>{if(event.persisted)load().catch(()=>gate('No se pudo recuperar la sesión.'));});
load().catch(error=>{console.warn(error);gate('No se pudo conectar con el archivo privado.');});
