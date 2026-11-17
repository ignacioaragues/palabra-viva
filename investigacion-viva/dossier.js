
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
const client=createClient('https://nzjdlqanbclsfwwstkwi.supabase.co','sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const slug=document.documentElement.dataset.researchSlug;
const $=id=>document.getElementById(id);
const element=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=String(content);return e};
const headingSets={
 'universales-cosmicos':['Resumen','Referencias','1. La pregunta','2. Generalidad, extrapolación y reconocimiento','3. Del dominio humano a la comparación terrestre y xenolingüística','4. Método: auditoría exploratoria y casos diagnósticos','5. Casos diagnósticos','5.1. ONE y GOOD: capacidad relacionada no equivale a contenido','5.2. BODY, PART y LIVE/DIE: el problema de la individuación','5.3. ABOVE/BELOW: compartir el espacio no fija su parametrización','5.4. NOT: continuidad operacional sin identidad semántica demostrada','6. Qué produce la comparación','7. De anclaje a evidencia discriminante','8. Qué cambia al pasar al dominio xenolingüístico','9. Garantías de traducibilidad','10. Cuatro escenarios de interpretación','11. Consecuencias para SETI, METI y primer contacto','12. Por qué reaparecen algunas regularidades','13. Limitaciones','14. Conclusión'],
 'privilegio-actualidad':['Resumen','Referencias','1 Introducción','2 Salvabilidad individual y elección divina','El amor perfecto y las posibilidades de salvación','Mundos posibles y mundos factibles','La decisión de crear a quien se perdería necesariamente','La selección providencial de circunstancias','El mejor mundo y el bien de cada criatura','3 Los sentidos del privilegio de la actualidad','Actualidad indicial y realidad efectiva','Responsabilidad por los actos y exclusividad del juicio','4 La hipótesis de varios mundos actuales completos','Mundos independientes y universos dentro de un mundo','La respuesta de las múltiples actualidades','La pluralidad actual y la relevancia salvífica','5 Identidad personal y juicio entre mundos actuales','El problema: identidad modal e identidad de una persona efectivamente creada','Tres modelos de identidad y su alcance escatológico','De la identidad numérica a la unidad del sujeto moral','Dos historias efectivas: conflicto aparente y conflicto genuino','Un juicio global: jurisdicción, verdad y reparación','La prioridad de la reconciliación como presunción, no como regla demostrada','El juicio puede considerar posibilidades sin hacerlas actuales','Alcance de la prueba y resultado condicional','6 Prioridad temporal y suerte de las circunstancias','El orden de las actualizaciones y la autoridad del juicio','Muerte y posibilidad de arrepentimiento','Cercanía modal y suerte salvífica','7 Objeciones al juicio transmundano','La imputación de acciones ajenas o contrafácticas','La elección divina y la responsabilidad de la criatura','Las restricciones de realizabilidad conjunta','La libertad de un resultado universal','El problema del mal y los bienes de las víctimas','8 Conclusiones']
};
let user=null, catalog=[], docs=[],progress={version:1,status:{},notes:{},priority:{}},sessions=[],timer=null,chosenDoc=null;
let saveQueue=Promise.resolve(),saveDebounce=null,generation=0,lastInteraction=Date.now(),currentTab='biblioteca',lastNoteId=null;
const formatTime=sec=>{const n=Math.max(0,Math.floor(sec)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return h?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')};
const fmtClock=ms=>{let n=Math.floor(ms/1000);return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(v=>String(v).padStart(2,'0')).join(':')};
const sec=s=>Math.max(0,Number(s.duration_seconds)||0);
function showGate(message=''){++generation;$('loading-state').hidden=true;$('private-app').hidden=true;$('gate').hidden=false;$('footer-state').textContent='Acceso restringido';if(message)$('login-error').textContent=message}
function sync(message){$('study-sync').textContent=message}
function currentStatus(entry){return progress.status?.[entry.id]||'pending'}
function itemTitle(item){
 if(item.title)return item.title;
 const t=item.label||'',match=t.match(/\(\d{4}\)\.\s+([\s\S]+?)(?:\.\s+(?:[A-ZÀ-Ö]|\bhttps?:\/\/)|$)/);
 return (match?.[1]||t).slice(0,170);
}
function filterItems(){
 const q=$('inventory-search').value.toLowerCase().trim(),state=$('inventory-state').value,prio=$('inventory-priority').checked;
 const filtered=catalog.filter(item=>(!q||[item.title,item.label,item.author,item.description].join(' ').toLowerCase().includes(q))&&(state==='all'||currentStatus(item)===state)&&(!prio||progress.priority?.[item.id]));
 return filtered.sort((a,b)=>(currentStatus(a)==='done'?-1:0)-(currentStatus(b)==='done'?-1:0)||Number(!!progress.priority?.[b.id])-Number(!!progress.priority?.[a.id]));
}
function persistProgress(delay=300){
 if(!user)return;clearTimeout(saveDebounce);
 sync('Guardando cambios…');
 const generationAtCall=generation;
 saveDebounce=setTimeout(()=>{
  const snapshot=JSON.parse(JSON.stringify(progress)),uid=user.id;
  saveQueue=saveQueue.then(async()=>{
   if(generationAtCall!==generation)return;
   const {error}=await client.from('iv_progress').upsert({owner_id:uid,dossier_slug:slug,data:snapshot,updated_at:new Date().toISOString()},{onConflict:'owner_id,dossier_slug'});
   if(error)throw error;if(generationAtCall===generation)sync('Cambios guardados en tu cuenta.');
  }).catch(e=>{console.warn(e);sync('No se pudo guardar el progreso. Revisá la conexión.')});
 },delay);
}
function openDoc(entry){
 const target=docs.find(doc=>doc.document_id===entry.doc_id);
 if(!target)return;
 switchTab('dossier');showDocument(target);
 startTimer('dossier:'+target.document_id,target.title,false);
}
function createItem(entry){
 const card=element('article','study-inventory-item');card.dataset.status=currentStatus(entry);
 const kind=entry.kind==='texto-propio'?'DOCUMENTO PROPIO · VERSIÓN WEB':'REFERENCIA BIBLIOGRÁFICA';
 card.append(element('span','study-inventory-kind',kind),element('h3','',itemTitle(entry)));
 if(entry.kind==='referencia')card.append(element('p','',entry.label||''));
 else card.append(element('p','',entry.description||''));
 const controls=element('div','study-inventory-actions');
 const status=element('select');status.setAttribute('aria-label','Estado de lectura');
 for(const [value,label] of [['pending','Pendiente'],['reading','En curso'],['done','Leído']]){const opt=element('option','',label);opt.value=value;status.append(opt)}
 status.value=currentStatus(entry);
 status.addEventListener('change',()=>{progress.status[entry.id]=status.value;persistProgress();renderInventory();renderMetrics()});
 controls.append(status);
 const star=element('button',progress.priority?.[entry.id]?'priority-on':'','★ Prioridad');star.type='button';
 star.setAttribute('aria-pressed',String(!!progress.priority?.[entry.id]));
 star.addEventListener('click',()=>{progress.priority[entry.id]=!progress.priority?.[entry.id];persistProgress();renderInventory()});
 controls.append(star);
 if(entry.doc_id){const read=element('button','','Leer dosier →');read.type='button';read.addEventListener('click',()=>openDoc(entry));controls.append(read)}
 if(entry.url && /^https:\/\//i.test(entry.url)){
  const href=element('a','','Abrir fuente ↗');href.href=entry.url;href.target='_blank';href.rel='noopener noreferrer';controls.append(href);
 }
 const time=element('button','','Cronometrar');time.type='button';
 time.addEventListener('click',()=>{switchTab('tiempo');$('timer-source').value=entry.id;startTimer(entry.id,itemTitle(entry),true)});
 controls.append(time);
 const noteButton=element('button','','Mi nota ↓');noteButton.type='button';controls.append(noteButton);card.append(controls);
 const note=element('textarea','study-note');note.maxLength=10000;note.value=progress.notes?.[entry.id]||'';note.placeholder='Tu anotación de lectura…';note.hidden=true;
 noteButton.addEventListener('click',()=>{note.hidden=!note.hidden;noteButton.textContent=note.hidden?'Mi nota ↓':'Cerrar nota ↑'});
 note.addEventListener('input',()=>{progress.notes[entry.id]=note.value;persistProgress(650)});
 card.append(note);
 return card;
}
function renderInventory(){
 const root=$('inventory');root.replaceChildren();
 const shown=filterItems();$('inventory-count').textContent=shown.length+' de '+catalog.length+' registros';
 if(!shown.length){root.append(element('p','study-empty','No hay referencias para este filtro.'));return}
 const fragment=document.createDocumentFragment();shown.forEach(e=>fragment.append(createItem(e)));root.append(fragment);
}
function findHead(line){
 const v=line.trim().replace(/\s+/g,' ');
 return (headingSets[slug]||[]).find(h=>h===v)||null;
}
function renderDocument(doc){
 const root=$('document-body'),toc=$('document-toc');root.replaceChildren();toc.replaceChildren();
 root.append(element('h1','',doc.title),element('p','article-subtitle',doc.subtitle||''));
 let lines=(doc.body_text||'').split(/\r?\n/),buffer=[],abstract=false,isReferences=false,headingCount=0;
 function flush(){
  const raw=buffer.join(' ').replace(/\s+/g,' ').replace(/\s+([.,;:!?])/g,'$1').trim();buffer=[];
  if(!raw)return;
  const p=element('p',abstract?'abstract':'',raw);
  root.append(p);
 }
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!line){flush();continue}
  const heading=findHead(line);
  if(heading){
   flush();if(heading==='Referencias'){isReferences=true;break}
   abstract=heading==='Resumen';
   const isMinor=/^\d+\.\d+\./.test(heading)||!(/^\d+\.?\s/.test(heading))&&heading!=='Resumen';
   const tag=isMinor?'h3':'h2',id='section-'+(++headingCount);
   const h=element(tag,'',heading);h.id=id;root.append(h);
   const a=element('a',isMinor?'subheading':'',heading);a.href='#'+id;toc.append(a);continue;
  }
  // PDF-extracted line wraps are joined; a complete sentence before a new
  // capitalized line is a strong paragraph boundary, unless in a citation.
  const prev=buffer[buffer.length-1];
  if(prev && /[.!?»:)]$/.test(prev) && /^[A-ZÁÉÍÓÚÑ¿¡«]/.test(line) && prev.length<150 && buffer.join(' ').length>125){flush()}
  if(/^Palabras clave:/.test(line) && buffer.length)flush();
  buffer.push(line);
 }
 flush();
 if(isReferences){
  const h=element('h2','','Referencias');h.id='section-'+(++headingCount);root.append(h);
  const a=element('a','','Referencias');a.href='#'+h.id;toc.append(a);
  for(const item of catalog.filter(e=>e.kind==='referencia')){
   const p=element('p','reference-paragraph',item.label||'');
   if(item.url && /^https:\/\//.test(item.url)){
    const link=element('a','',' Abrir referencia ↗');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';p.append(link);
   }
   root.append(p);
  }
 }
 $('reading-document-title').textContent=doc.title;
}
function showDocument(doc){
 chosenDoc=doc;renderDocument(doc);
 for(const btn of document.querySelectorAll('[data-document-id]'))btn.setAttribute('aria-pressed',String(btn.dataset.documentId===doc.document_id));
}
function renderDocumentOptions(){
 const root=$('document-options');root.replaceChildren();
 for(const doc of docs){
  const names={'revision-v3':'Revisión v3 · principal','revision-v2-auditada':'Revisión auditada v2 · archivo','revision-identidad-juicio':'Revisión de identidad y juicio · principal','borrador-reformulado-noviembre':'Borrador reformulado · archivo','borrador-octubre':'Borrador inicial · archivo'};
  const button=element('button','',names[doc.document_id]||doc.title);
  button.dataset.documentId=doc.document_id;button.type='button';
  button.addEventListener('click',()=>{showDocument(doc);startTimer('dossier:'+doc.document_id,doc.title,false)});
  root.append(button);
 }
 if(docs.length)showDocument(docs[0]);
 else $('document-body').append(element('p','study-empty','Todavía no hay un texto cargado en el archivo privado.'));
 const stored=Number(localStorage.getItem('iv-reader-font')||18);
 $('document-body').style.setProperty('--reader-size',Math.max(14,Math.min(25,stored))+'px');
}
$('font-up').addEventListener('click',()=>resize(1));$('font-down').addEventListener('click',()=>resize(-1));
function resize(delta){let n=parseInt(getComputedStyle($('document-body')).getPropertyValue('--reader-size'))||18;n=Math.max(14,Math.min(25,n+delta));$('document-body').style.setProperty('--reader-size',n+'px');localStorage.setItem('iv-reader-font',String(n))}
function switchTab(name){
 currentTab=name;
 for(const tab of document.querySelectorAll('[data-tab]'))tab.setAttribute('aria-selected',String(tab.dataset.tab===name));
 for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==name;
 if(name==='tiempo')refreshTimerUI();
}
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>switchTab(button.dataset.tab)));
document.querySelectorAll('[data-open-tab]').forEach(button=>button.addEventListener('click',()=>switchTab(button.dataset.openTab)));
$('inventory-search').addEventListener('input',renderInventory);$('inventory-state').addEventListener('change',renderInventory);$('inventory-priority').addEventListener('change',renderInventory);
function sourceChoices(){
 const pick=$('timer-source');const choice=pick.value;pick.replaceChildren();
 for(const item of catalog){
  const opt=element('option','',item.kind==='texto-propio'?'Dosier: '+itemTitle(item):itemTitle(item));
  opt.value=item.doc_id?'dossier:'+item.doc_id:item.id;pick.append(opt);
 }
 if(choice && [...pick.options].some(x=>x.value===choice))pick.value=choice;
}
function timeInSession(){return timer?timer.totalMs+(timer.active?Math.max(0,Date.now()-timer.segmentStart):0):0}
let writeQueue=Promise.resolve();
function logSegment(){
 if(!timer?.active||!user)return;
 const now=Date.now(),delta=now-timer.segmentStart;if(delta<900)return;
 const snapshot={owner_id:user.id,dossier_slug:slug,source_id:timer.id,source_title:timer.title.slice(0,220),
  duration_seconds:Math.max(1,Math.round(delta/1000)),started_at:new Date(timer.segmentStart).toISOString()};
 timer.totalMs+=delta;timer.segmentStart=now;
 writeQueue=writeQueue.then(async()=>{
  const {data,error}=await client.from('iv_reading_sessions').insert(snapshot).select('id,source_id,source_title,duration_seconds,started_at,dossier_slug').single();
  if(error)throw error;sessions.unshift(data);renderMetrics();renderTimeSummary();renderHistory();
 }).catch(e=>{console.warn('No se pudo registrar la sesión de lectura',e);sync('No se pudo sincronizar una sesión de lectura. Revisá la conexión.')});
}
function startTimer(id,title,external=false){
 if(timer?.active && timer.id===id){timer.external=external;refreshTimerUI();return}
 if(timer?.active)logSegment();
 timer={id,title,totalMs:0,segmentStart:Date.now(),active:true,external};
 $('timer-source').value=id;lastInteraction=Date.now();refreshTimerUI();
 sync(external?'Sesión externa iniciada: detenela cuando termines.':'Lectura en curso. El contador se sincroniza periódicamente.');
}
function pauseTimer(){
 if(!timer?.active)return;logSegment();timer.active=false;refreshTimerUI();
}
function resumeTimer(){
 if(!timer){const id=$('timer-source').value,entry=catalog.find(x=>x.id===id||('dossier:'+x.doc_id)===id);startTimer(id,entry?itemTitle(entry):'Lectura',true);return}
 timer.segmentStart=Date.now();timer.active=true;lastInteraction=Date.now();refreshTimerUI();
}
function finishTimer(){
 if(timer?.active)logSegment();
 timer=null;refreshTimerUI();sync('Sesión finalizada. El tiempo registrado se conserva en tu cuenta.');
}
$('timer-toggle').addEventListener('click',()=>{if(timer?.active)pauseTimer();else resumeTimer()});
$('timer-stop').addEventListener('click',finishTimer);
$('timer-source').addEventListener('change',()=>{
 if(timer?.active){logSegment();timer=null}
 refreshTimerUI();
});
function refreshTimerUI(){
 $('timer-clock').textContent=fmtClock(timeInSession());
 $('timer-status').textContent=timer?(timer.active?timer.title+(timer.external?' · lectura externa':' · lectura del dosier'):'Pausado · '+timer.title):'Sin una lectura en curso.';
 $('timer-toggle').textContent=timer?.active?'Pausar':'Empezar lectura';
 $('timer-stop').disabled=!timer;
}
function dayStart(x){const d=new Date(x);d.setHours(0,0,0,0);return d}
function sundayStart(x){const d=dayStart(x);d.setDate(d.getDate()-d.getDay());return d}
function fmtDate(d){return new Intl.DateTimeFormat('es-AR',{weekday:'short',day:'numeric',month:'short'}).format(d)}
function sumSince(date){return sessions.filter(s=>s.dossier_slug===slug&&new Date(s.started_at)>=date).reduce((a,b)=>a+sec(b),0)}
function renderMetrics(){
 const projectSessions=sessions.filter(x=>x.dossier_slug===slug),now=new Date();
 $('metric-references').textContent=catalog.length;
 $('metric-read').textContent=catalog.filter(x=>currentStatus(x)==='done').length;
 $('metric-today').textContent=formatTime(sumSince(dayStart(now)));
 $('metric-week').textContent=formatTime(sumSince(sundayStart(now)));
 $('metric-all').textContent=formatTime(projectSessions.reduce((a,b)=>a+sec(b),0));
}
function renderTimeSummary(){
 const container=$('time-summary');container.replaceChildren();
 const own=sessions.filter(x=>x.dossier_slug===slug),now=new Date(),today=dayStart(now),week=sundayStart(now),total=own.reduce((a,s)=>a+sec(s),0);
 for(const [title,count] of [['HOY',sumSince(today)],['ESTA SEMANA',sumSince(week)],['TOTAL DEL PROYECTO',total],['N.º DE SESIONES',own.length]]){
  const div=element('div');div.append(element('strong','',title==='N.º DE SESIONES'?String(count):formatTime(count)),element('small','',title));container.append(div);
 }
 const days=Array.from({length:7},(_,i)=>{const d=dayStart(now);d.setDate(d.getDate()+i-6);const n=own.filter(s=>dayStart(new Date(s.started_at)).getTime()===d.getTime()).reduce((a,s)=>a+sec(s),0);return {d,n}});
 const max=Math.max(1,...days.map(x=>x.n)),bars=$('daily-bars');bars.replaceChildren();
 for(const {d,n} of days){const col=element('div');col.append(element('strong','',n?Math.round(n/60)+'m':'–'));
 const bar=element('span','bar');bar.style.height=Math.max(3,Math.round(n/max*82))+'px';col.append(bar,element('small','',new Intl.DateTimeFormat('es-AR',{weekday:'short'}).format(d)));bars.append(col)}
}
function renderHistory(){
 const history=$('session-history');history.replaceChildren();const items=sessions.filter(s=>s.dossier_slug===slug).slice(0,30);
 if(!items.length){history.append(element('p','study-empty','Todavía no hay sesiones registradas.'));return}
 for(const s of items){
  const row=element('div','study-history-item'),date=element('time','',fmtDate(new Date(s.started_at)));
  date.dateTime=s.started_at;row.append(date,element('span','',s.source_title||s.source_id),element('strong','',formatTime(sec(s))));history.append(row);
 }
}
function startTicker(){
 setInterval(()=>{
  if(!timer?.active)return;
  if(!timer.external && (document.hidden || !document.hasFocus() || Date.now()-lastInteraction>180000)){pauseTimer();sync('Lectura pausada por inactividad.');return}
  if(Date.now()-timer.segmentStart>45000)logSegment();
  refreshTimerUI();
 },1000);
 for(const ev of ['pointerdown','pointermove','scroll','keydown','touchstart'])document.addEventListener(ev,()=>{lastInteraction=Date.now()},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&!timer?.external)pauseTimer()});
 window.addEventListener('blur',()=>{if(!timer?.external)pauseTimer()});
 window.addEventListener('pagehide',()=>{logSegment()});
}
async function load(){
 const request=++generation;$('loading-state').hidden=false;
 const {data:auth,error:authError}=await client.auth.getUser();if(request!==generation)return;
 if(authError||!auth.user){showGate();return}
 const res=await client.from('iv_dossiers').select('slug,title,catalog').eq('slug',slug).maybeSingle();
 if(request!==generation)return;
 if(res.error||!res.data){showGate('Esta cuenta no puede abrir el proyecto.');return}
 user=auth.user;catalog=Array.isArray(res.data.catalog)?res.data.catalog:[];
 const [docRes,progressRes,sessionsRes]=await Promise.all([
  client.from('iv_documents').select('document_id,title,subtitle,body_text,source_label').eq('dossier_slug',slug).order('updated_at',{ascending:false}),
  client.from('iv_progress').select('data').eq('owner_id',user.id).eq('dossier_slug',slug).maybeSingle(),
  client.from('iv_reading_sessions').select('id,dossier_slug,source_id,source_title,duration_seconds,started_at').eq('owner_id',user.id).order('started_at',{ascending:false}).limit(2000)
 ]);
 if(request!==generation)return;
 if(docRes.error||progressRes.error||sessionsRes.error){console.warn(docRes.error,progressRes.error,sessionsRes.error);showGate('Error al recuperar los datos privados.');return}
 docs=docRes.data||[];docs.sort((a,b)=>{
   const primary=slug==='universales-cosmicos'?'revision-v3':'revision-identidad-juicio';
   if(a.document_id===primary)return -1;if(b.document_id===primary)return 1;
   return String(b.document_id).localeCompare(String(a.document_id));
  });
 sessions=sessionsRes.data||[];
 const state=progressRes.data?.data||{};progress={version:1,status:state.status||{},notes:state.notes||{},priority:state.priority||{}};
 $('study-title').textContent=res.data.title;$('private-app').hidden=false;$('gate').hidden=true;$('loading-state').hidden=true;
 $('footer-state').textContent='Cuenta autorizada';
 renderInventory();renderDocumentOptions();sourceChoices();renderMetrics();renderTimeSummary();renderHistory();refreshTimerUI();sync('Archivo privado sincronizado.');
}
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;
 $('login-error').textContent='';
 try{const {error}=await client.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});if(error)throw error;$('login-password').value='';await load()}
 catch(e){console.warn(e);$('login-error').textContent='No se pudo iniciar sesión. Revisá las credenciales.'}
 finally{button.disabled=false}
});
client.auth.onAuthStateChange((ev)=>{
 if(ev==='SIGNED_OUT'){if(timer?.active)logSegment();timer=null;user=null;showGate()}
});
startTicker();
load().catch(e=>{console.warn(e);showGate('No se pudo cargar el proyecto.');});
