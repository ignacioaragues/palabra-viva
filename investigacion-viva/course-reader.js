import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
const client=createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const slug=document.documentElement.dataset.researchSlug;
const gate=$('course-gate'),loading=$('course-loading'),app=$('reader-app');
let owner=null,lessons=[],bibliography=[],current=-1,progress={version:1,completed:{},notes:{}};
let saveQueue=Promise.resolve(),saveTimer=null,epoch=0;
const el=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x};
function showGate(message){
  loading.hidden=true;app.hidden=true;gate.hidden=false;
  $('gate-error').textContent=message||'';
}
function safeLink(url){
  try {const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null}
}
function inline(target,source){
  const pattern=/(\*\*([^*]+)\*\*|\*([^*]+)\*|\x60([^\x60]+)\x60)/g;
  let cursor=0,m;
  while((m=pattern.exec(source))){
    if(m.index>cursor)target.append(document.createTextNode(source.slice(cursor,m.index)));
    const node=el(m[2]?'strong':m[3]?'em':'code');
    node.textContent=m[2]||m[3]||m[4];
    target.append(node);cursor=pattern.lastIndex;
  }
  if(cursor<source.length)target.append(document.createTextNode(source.slice(cursor)));
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
  renderMarkdown(x.body_text||'');renderReadings(index);renderList();summary();
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
    client.from('iv_dossiers').select('slug,title,catalog').eq('slug',slug).maybeSingle(),
    client.from('iv_documents').select('document_id,title,subtitle,body_text,source_label')
      .eq('dossier_slug',slug).like('document_id','curso-%').order('document_id'),
    client.from('iv_progress').select('data').eq('owner_id',owner.id).eq('dossier_slug',slug).maybeSingle()
  ]);
  if(d.error||docs.error||previous.error||!d.data){
    showGate('No se pudo recuperar el curso o esta cuenta no tiene acceso.');return;
  }
  lessons=docs.data||[];bibliography=Array.isArray(d.data.catalog)?d.data.catalog:[];
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
