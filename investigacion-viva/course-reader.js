import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
const client=createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const slug=document.documentElement.dataset.researchSlug;
const gate=$('course-gate'),loading=$('course-loading'),app=$('reader-app');
let owner=null,lessons=[],bibliography=[],visuals=[],current=-1,progress={version:1,completed:{},notes:{}};
let saveQueue=Promise.resolve(),saveTimer=null,epoch=0;
const el=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x};
function showGate(message){
  loading.hidden=true;app.hidden=true;gate.hidden=false;
  $('gate-error').textContent=message||'';
}
function safeLink(url){
  try {const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null}
}
function appendLinkedText(target,value){
  const re=/https:\/\/[^\s<>]+/g;
  let pos=0,match;
  while((match=re.exec(value))){
    if(match.index>pos)target.append(document.createTextNode(value.slice(pos,match.index)));
    const raw=match[0],clean=raw.replace(/[.,;:!?)]+$/,'');
    const link=safeLink(clean);
    if(link){
      const a=el('a','source-link',clean);
      a.href=link;a.target='_blank';a.rel='noopener noreferrer';
      target.append(a);
    }else target.append(document.createTextNode(clean));
    if(raw.length>clean.length)target.append(document.createTextNode(raw.slice(clean.length)));
    pos=re.lastIndex;
  }
  if(pos<value.length)target.append(document.createTextNode(value.slice(pos)));
}
function inline(target,source){
  const pattern=/(\*\*([^*]+)\*\*|\*([^*]+)\*|\x60([^\x60]+)\x60)/g;
  let cursor=0,m;
  while((m=pattern.exec(source))){
    if(m.index>cursor)appendLinkedText(target,source.slice(cursor,m.index));
    const node=el(m[2]?'strong':m[3]?'em':'code');
    node.textContent=m[2]||m[3]||m[4];
    target.append(node);cursor=pattern.lastIndex;
  }
  if(cursor<source.length)appendLinkedText(target,source.slice(cursor));
}
function renderMarkdown(markdown){
  const root=$('lesson-body');root.replaceChildren();
  for(const block of markdown.trim().split(/\n\s*\n/)){
    const lines=block.trim().split('\n');
    if(lines[0].startsWith('## ')){
      const h=el('h3');inline(h,lines[0].slice(3));root.append(h);
      if(lines.length>1){const p=el('p');inline(p,lines.slice(1).join(' '));root.append(p);}
    }else if(lines.every(line=>/^\d+\. /.test(line))){
      const list=el('ol');
      for(const line of lines){const li=el('li');inline(li,line.replace(/^\d+\. /,''));list.append(li)}
      root.append(list);
    }else{
      const p=el('p');inline(p,lines.join(' '));root.append(p);
    }
  }
}
function readingCard(item){
  const card=el('article','reading-card');
  const head=el('div','reading-card-head');
  head.append(el('span','reading-kind',item.kind||'Lectura'));
  if(item.priority==='esencial')head.append(el('span','reading-essential','ESENCIAL'));
  card.append(head);
  const link=safeLink(item.url),title=el(link?'a':'strong','reading-title',item.title);
  if(link){title.href=link;title.target='_blank';title.rel='noopener noreferrer';}
  card.append(title,el('p','reading-author',[item.author,item.year].filter(Boolean).join(' · ')));
  if(item.why)card.append(el('p','reading-why',item.why));
  if(item.access)card.append(el('small','reading-access',item.access));
  return card;
}
function renderReadings(index){
  const lesson=index+1;
  const entries=bibliography.filter(b=>Array.isArray(b.lessons)&&b.lessons.includes(lesson));
  const target=$('reading-items');target.replaceChildren();
  const preferred=[...entries].sort((a,b)=>Number(b.priority==='esencial')-Number(a.priority==='esencial'));
  for(const b of preferred)target.append(readingCard(b));
}
function renderLibrary(){
  const target=$('library-items');target.replaceChildren();
  for(const b of bibliography)target.append(readingCard(b));
}
function renderVisuals(index){
  const target=$('lesson-visuals');if(!target)return;
  target.replaceChildren();
  const entries=visuals.filter(v=>Array.isArray(v.lessons)&&v.lessons.includes(index+1));
  if(!entries.length){target.hidden=true;return}
  target.hidden=false;
  const heading=el('div','section-head');
  heading.append(el('span','eyebrow','ATLAS VISUAL'),el('h3',null,'Lugares y momentos'));
  heading.append(el('p',null,'Cronología y mapa esquemático de centros relevantes. Las conexiones indican circulación histórica general, no rutas individuales demostradas.'));
  target.append(heading);
  const timeline=entries.filter(v=>v.type==='timeline').sort((a,b)=>a.year-b.year);
  if(timeline.length){
    const wrap=el('div','visual-timeline');
    for(const v of timeline){
      const item=el('article','visual-event');
      item.append(el('span','visual-date',v.period),el('strong',null,v.title),el('small',null,v.place),el('p',null,v.description));
      const link=safeLink(v.url);
      if(link){const a=el('a','visual-source','Consultar fuente ↗');a.href=link;a.target='_blank';a.rel='noopener noreferrer';item.append(a)}
      wrap.append(item);
    }
    target.append(wrap);
  }
  const routes=visuals.filter(v=>v.type==='route').sort((a,b)=>a.order-b.order);
  if(routes.length){
    const figure=el('figure','visual-map');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 680 340');svg.setAttribute('role','img');
    svg.setAttribute('aria-label','Esquema de centros de transmisión alquímica entre Egipto, Mesopotamia, Iberia, Alemania e Inglaterra');
    const ns='http://www.w3.org/2000/svg';
    const node=(tag,attrs)=>{const x=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))x.setAttribute(k,String(v));return x};
    const coords=v=>({x:Math.round(80+(v.lon+12)*9.8),y:Math.round(300-(v.lat-25)*8.1)});
    svg.append(node('rect',{x:0,y:0,width:680,height:340,fill:'#edf0e9'}));
    for(const lat of [30,40,50]){const y=coords({lat,lon:0}).y;svg.append(node('line',{x1:25,x2:655,y1:y,y2:y,stroke:'#d0d9cf','stroke-dasharray':'3 6'}));}
    for(let i=0;i<routes.length-1;i++){
      const a=coords(routes[i]),b=coords(routes[i+1]);
      svg.append(node('path',{d:'M'+a.x+' '+a.y+' Q'+((a.x+b.x)/2)+' '+(Math.min(a.y,b.y)-28)+' '+b.x+' '+b.y,fill:'none',stroke:'#9aaea0','stroke-width':2,'stroke-dasharray':'6 6'}));
    }
    for(const v of routes){
      const p=coords(v);
      svg.append(node('circle',{cx:p.x,cy:p.y,r:8,fill:'#9e6a54',stroke:'#fff', 'stroke-width':2}));
      const t=node('text',{x:p.x+12,y:p.y-10,fill:'#314a39','font-size':12,'font-family':'sans-serif','font-weight':'600'});
      t.textContent=v.place;svg.append(t);
    }
    figure.append(svg,el('figcaption',null,'Mapa conceptual, no cartografía georreferenciada: posiciones aproximadas y flechas ilustrativas. No se postula una cadena única de transmisión.'));
    target.append(figure);
    const list=el('div','visual-places');
    for(const v of routes){
      const row=el('p');row.append(el('strong',null,v.place+' · '),document.createTextNode(v.description));list.append(row);
    }
    target.append(list);
  }
}
function summary(){
  const done=lessons.filter(x=>progress.completed[x.document_id]).length;
  $('course-progress-label').textContent=done+' de '+lessons.length+' completadas';
  const percent=lessons.length?done/lessons.length*100:0;
  $('course-progress').setAttribute('aria-valuenow',String(Math.round(percent)));
  $('course-progress').querySelector('span').style.width=percent+'%';
}
function renderList(){
  const list=$('lesson-list');list.replaceChildren();
  lessons.forEach((lesson,index)=>{
    const isCurrent=index===current,done=!!progress.completed[lesson.document_id];
    const button=el('button','lesson-nav'+(isCurrent?' selected':'')+(done?' completed':''));button.type='button';
    button.setAttribute('aria-current',isCurrent?'step':'false');
    button.append(el('span','lesson-index',String(index+1).padStart(2,'0')),
      el('span','lesson-nav-title',lesson.title),
      el('span','lesson-tick',done?'✓':''));
    button.addEventListener('click',()=>selectLesson(index,true));
    list.append(button);
  });
}
function selectLesson(index,scroll){
  if(index<0||index>=lessons.length)return;
  const unsaved=saveTimer!==null;
  clearTimeout(saveTimer);saveTimer=null;
  // Capturar el texto anterior y no perder un guardado pendiente al navegar.
  if(current>=0 && owner){
    const old=lessons[current].document_id;
    const value=$('lesson-notes').value;
    const changed=(progress.notes[old]||'')!==value;
    if(changed)progress.notes[old]=value;
    if(unsaved||changed)persist(0);
  }
  current=index;const x=lessons[index];
  $('lesson-number').textContent='LECCIÓN '+String(index+1).padStart(2,'0')+' / '+lessons.length;
  $('reading-document-title').textContent=x.title;
  $('lesson-subtitle').textContent=x.subtitle||'';
  $('lesson-notes').value=progress.notes[x.document_id]||'';
  $('lesson-save-state').textContent='';
  renderMarkdown(x.body_text||'');renderReadings(index);renderVisuals(index);renderList();summary();
  $('lesson-done').textContent=progress.completed[x.document_id]?'✓ Lección completada':'Marcar lección como completa';
  $('lesson-done').classList.toggle('is-done',!!progress.completed[x.document_id]);
  $('lesson-next').disabled=index===lessons.length-1;
  history.replaceState(null,'','?leccion='+encodeURIComponent(x.document_id));
  if(scroll)document.querySelector('.course-layout').scrollIntoView({behavior:'smooth',block:'start'});
}
function persist(delay=300){
  if(!owner)return;
  clearTimeout(saveTimer);
  $('lesson-save-state').textContent='Guardando…';
  const currentEpoch=epoch;
  saveTimer=setTimeout(()=>{
    const snapshot=JSON.parse(JSON.stringify(progress)),id=owner.id;
    saveQueue=saveQueue.then(async()=>{
      if(epoch!==currentEpoch)return;
      const {error}=await client.from('iv_progress').upsert(
        {owner_id:id,dossier_slug:slug,data:snapshot,updated_at:new Date().toISOString()},
        {onConflict:'owner_id,dossier_slug'});
      if(error)throw error;
      if(epoch===currentEpoch)$('lesson-save-state').textContent='Notas y progreso guardados.';
    }).catch(err=>{
      console.warn('Error al guardar progreso del curso:',err);
      if(epoch===currentEpoch)$('lesson-save-state').textContent='No se pudieron guardar los cambios.';
    });
  },delay);
}
$('lesson-notes').addEventListener('input',()=>{
  if(current<0)return;
  progress.notes[lessons[current].document_id]=$('lesson-notes').value.slice(0,20000);
  persist(650);
});
$('lesson-done').addEventListener('click',()=>{
  if(current<0)return;
  const id=lessons[current].document_id;
  progress.completed[id]=!progress.completed[id];
  selectLesson(current,false);persist(0);
});
$('lesson-next').addEventListener('click',()=>selectLesson(current+1,true));
client.auth.onAuthStateChange((event)=>{
  if(event==='SIGNED_OUT'){++epoch;owner=null;lessons=[];bibliography=[];progress={version:1,completed:{},notes:{}};showGate('Tu sesión se cerró.');}
});
async function initialise(){
  const auth=await client.auth.getUser();
  if(auth.error||!auth.data.user){showGate('No hay una sesión activa.');return}
  owner=auth.data.user;
  // El HTML y el JS no contienen la biblioteca: sólo se descarga tras RLS.
  const [d,docs,previous]=await Promise.all([
    client.from('iv_dossiers').select('slug,title,catalog,visual_catalog').eq('slug',slug).maybeSingle(),
    client.from('iv_documents').select('document_id,title,subtitle,body_text,source_label')
      .eq('dossier_slug',slug).like('document_id','curso-%').order('document_id'),
    client.from('iv_progress').select('data').eq('owner_id',owner.id).eq('dossier_slug',slug).maybeSingle()
  ]);
  if(d.error||docs.error||previous.error||!d.data){
    showGate('No se pudo recuperar el curso o esta cuenta no tiene acceso.');return;
  }
  lessons=docs.data||[];bibliography=Array.isArray(d.data.catalog)?d.data.catalog:[];visuals=Array.isArray(d.data.visual_catalog)?d.data.visual_catalog:[];
  if(previous.data?.data && typeof previous.data.data==='object'){
    const data=previous.data.data;
    progress={version:1,
      completed:data.completed&&typeof data.completed==='object'?data.completed:{},
      notes:data.notes&&typeof data.notes==='object'?data.notes:{}};
  }
  $('course-title').textContent=d.data.title||'Curso de investigación';
  document.title=d.data.title+' · Investigación Viva';
  $('course-count').textContent=lessons.length+' lecciones';
  if(!lessons.length){showGate('Este proyecto todavía no tiene lecciones publicadas.');return}
  renderLibrary();renderList();
  const preferred=new URLSearchParams(location.search).get('leccion');
  const index=Math.max(0,lessons.findIndex(x=>x.document_id===preferred));
  selectLesson(index,false);
  gate.hidden=true;loading.hidden=true;app.hidden=false;
}
initialise().catch(error=>{console.warn(error);showGate('No se pudo conectar. Intentá recargar la página.');});
