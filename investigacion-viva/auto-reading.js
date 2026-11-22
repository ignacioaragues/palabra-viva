import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

// Contador común a los cuadernos y a las fichas de Investigación Viva.
// Guarda fragmentos de hasta 20 s y respeta una lectura iniciada manualmente.
const client=createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const slug=document.documentElement.dataset.researchSlug || (
  location.pathname.includes('/estados-con-aura/')?'estados-con-aura':'leo-attila');
const root=document.getElementById('private-app')||document.getElementById('reader-app')||document.getElementById('app');
const autoId='automatico:'+Math.random().toString(36).slice(2,10);
const MAX_IDLE=5*60*1000, FLUSH_AFTER=20000;
let owner=null,allowed=false,activeFrom=null,lastActivity=Date.now(),pending=Promise.resolve();
let activeMs=0,sessionSeconds=0,lastLabel='',disposed=false;
const indicator=document.createElement('span');
indicator.className='iv-auto-indicator';
indicator.setAttribute('aria-live','off');
indicator.title='Tiempo de lectura automático: se pausa al cambiar de pestaña o tras cinco minutos sin actividad';
indicator.textContent='Lectura automática · —';
document.querySelector('.top-nav')?.append(indicator);
if(!indicator.isConnected){
  const header=document.querySelector('.masthead nav');
  header?.append(indicator);
}
function visible(){return root&&!root.hidden&&!document.hidden&&document.hasFocus();}
function manual(){return window.__ivManualTimerActive===true;}
function msToClock(ms) {
  const seconds=Math.floor(ms/1000);
  return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
}
function pageLabel() {
  const fragment=document.body.dataset.fragment;
  if(fragment) {
    const text=document.getElementById('reader-heading')?.textContent?.trim();
    return {id:'fragment:'+fragment,title:text||'Fragmentos históricos'};
  }
  const atlas=document.documentElement.dataset.atlasView;
  if(atlas==='entity') {
    const key=(new URLSearchParams(location.search).get('e')||'ficha').slice(0,75).replace(/[^a-zA-Z0-9-]/g,'-');
    return {id:'atlas:'+key,title:document.getElementById('entity-title')?.textContent?.trim()||'Ficha del atlas'};
  }
  if(atlas==='index')return {id:'atlas:indice',title:'Atlas · índice'};
  if(atlas==='map')return {id:'atlas:mapa',title:'Atlas de las soberanías · mapa'};
  if(document.getElementById('lesson-body')){
    const lesson=(new URLSearchParams(location.search).get('leccion')||'indice').slice(0,75).replace(/[^a-zA-Z0-9-]/g,'-');
    const title=document.getElementById('reading-document-title')?.textContent?.trim()||'Curso';
    return {id:'curso:'+lesson,title:'Curso · '+title};
  }
  if(slug==='investigacion-viva')return {id:'pagina:indice',title:'Investigación Viva · índice de proyectos'};
  if(slug==='leo-attila')return {id:'pagina:dossier',title:'León y Atila · biblioteca y dossier'};
  const tab=document.querySelector('[data-tab][aria-selected="true"]')?.dataset.tab || 'dossier';
  if(tab==='dossier'){
    const title=document.getElementById('reading-document-title')?.textContent?.trim();
    if(title)return{id:'pagina:dossier',title:'Dossier · '+title};
  }
  return {id:'pagina:'+tab,title:document.title+' · '+tab};
}
function activity() {
  if(disposed)return;
  reconcile();             // No contabilizar el rato anterior si ya había caducado.
  lastActivity=Date.now();
  reconcile();
}
function updateUI(){
  if(!indicator.isConnected)return;
  if(!owner||!allowed){indicator.textContent='Lectura automática · —';return;}
  const ms=activeMs+(activeFrom===null?0:Date.now()-activeFrom);
  indicator.textContent='Lectura automática · '+msToClock(ms)+(activeFrom===null?' · pausada':'');
}
function queueSave(start,end){
  const duration=Math.round((end-start)/1000);
  if(duration<1||!owner)return;
  const label=pageLabel();
  const row={
    owner_id:owner.id,
    dossier_slug:slug,
    source_id:label.id.slice(0,120),
    source_title:('Automático · '+label.title).slice(0,220),
    started_at:new Date(start).toISOString(),
    duration_seconds:Math.min(86400,duration)
  };
  sessionSeconds+=row.duration_seconds;
  pending=pending.then(async()=>{
    const {data,error}=await client.from('iv_reading_sessions')
      .insert(row).select('id,dossier_slug,source_id,source_title,duration_seconds,started_at').single();
    if(error)throw error;
    window.dispatchEvent(new CustomEvent('iv:auto-segment-saved',{detail:data}));
  }).catch(err=>{
    console.warn('Investigación Viva: no se pudo guardar un tramo automático',err);
    indicator.title='No se pudo sincronizar una sesión. Revisá la conexión.';
  });
}
function flush(end=Date.now()){
  if(activeFrom===null)return;
  const t=Math.max(activeFrom,Math.min(end,Date.now()));
  if(t-activeFrom<950)return;
  const start=activeFrom;
  activeMs+=t-start;
  activeFrom=t;
  queueSave(start,t);
}
function pause(end=Date.now()){
  if(activeFrom===null)return;
  flush(end);
  activeFrom=null;
  updateUI();
}
function reconcile(){
  if(!owner||!allowed||!visible()||manual()) {pause();return;}
  const now=Date.now(),expiration=lastActivity+MAX_IDLE;
  if(now>=expiration){pause(expiration);return;}
  if(activeFrom===null)activeFrom=now;
  if(now-activeFrom>=FLUSH_AFTER)flush(now);
  updateUI();
}
function onBlur(){pause();}
async function initialize(){
  const result=await client.auth.getUser();
  if(result.error||!result.data.user)return;
  const permission=await client.from('iv_dossiers').select('slug').eq('slug',slug).maybeSingle();
  if(permission.error||!permission.data)return;
  owner=result.data.user;allowed=true;lastActivity=Date.now();reconcile();
}
for(const event of ['scroll','pointerdown','keydown','touchstart','pointermove']){
  document.addEventListener(event,activity,{passive:true});
}
window.addEventListener('focus',activity);
window.addEventListener('blur',onBlur);
window.addEventListener('pagehide',()=>{disposed=true;pause();});
window.addEventListener('pageshow',()=>{disposed=false;lastActivity=Date.now();reconcile();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else activity();});
window.addEventListener('iv:manual-state',reconcile);
client.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'){pause();owner=null;allowed=false;updateUI();}
  else if(event==='SIGNED_IN' && !owner)initialize().catch(console.warn);
});
setInterval(reconcile,1000);
initialize().catch(console.warn);
