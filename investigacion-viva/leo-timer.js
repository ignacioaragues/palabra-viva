
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
const client=createClient('https://nzjdlqanbclsfwwstkwi.supabase.co','sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id),SLUG='leo-attila';
let user=null,timer=null,sessions=[],catalog=[],lastActivity=Date.now(),queue=Promise.resolve();
function markManual(value){window.__ivManualTimerActive=value;window.dispatchEvent(new Event('iv:manual-state'));}
const clock=ms=>[Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':');
const short=secs=>{const h=Math.floor(secs/3600),m=Math.floor(secs%3600/60);return h?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(secs%60).padStart(2,'0')};
const startOfDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
const startOfWeek=d=>{const x=startOfDay(d);x.setDate(x.getDate()-x.getDay());return x};
const seconds=s=>Number(s.duration_seconds)||0;
function ui(){
 const elapsed=timer?timer.total+(timer.active?Date.now()-timer.segment:0):0;
 $('leo-timer-clock').textContent=clock(elapsed);
 $('leo-timer-toggle').textContent=timer?.active?'Pausar':'Empezar lectura';
 $('leo-timer-hint').textContent=timer?(timer.active?'Leyendo: ':'En pausa: ')+timer.title:'Seleccioná la obra e iniciá la lectura.';
 $('leo-timer-stop').disabled=!timer;
}
function stats(){
 const now=new Date(),today=startOfDay(now),week=startOfWeek(now);
 const total=sessions.reduce((sum,s)=>sum+seconds(s),0);
 $('leo-time-today').textContent=short(sessions.filter(s=>new Date(s.started_at)>=today).reduce((sum,s)=>sum+seconds(s),0));
 $('leo-time-week').textContent=short(sessions.filter(s=>new Date(s.started_at)>=week).reduce((sum,s)=>sum+seconds(s),0));
 $('leo-time-total').textContent=short(total);
 $('leo-time-sessions').textContent=String(sessions.length);
}
function flush(){
 if(!timer?.active||!user)return;
 const now=Date.now(),elapsed=now-timer.segment;if(elapsed<850)return;
 const row={owner_id:user.id,dossier_slug:SLUG,source_id:timer.id,source_title:timer.title.slice(0,220),started_at:new Date(timer.segment).toISOString(),duration_seconds:Math.max(1,Math.round(elapsed/1000))};
 timer.total+=elapsed;timer.segment=now;
 queue=queue.then(async()=>{
   const {data,error}=await client.from('iv_reading_sessions').insert(row).select('source_id,source_title,duration_seconds,started_at').single();
   if(error)throw error;sessions.unshift(data);stats();
 }).catch(err=>{console.warn(err);$('leo-timer-sync').textContent='Error de sincronización. Revisá la conexión.'});
}
function stop(){if(timer?.active)flush();timer=null;markManual(false);ui();$('leo-timer-sync').textContent='Sesión terminada y guardada.'}
function pause(){if(timer?.active){flush();timer.active=false;markManual(false);ui()}}
function toggle(){
 if(!user)return;
 if(timer?.active){pause();return}
 const id=$('leo-timer-source').value;
 const item=catalog.find(x=>x.id===id);if(!item)return;
 if(timer && timer.id===id){timer.active=true;timer.segment=Date.now()}
 else timer={id,title:[item.author,item.title].filter(Boolean).join(' · '),active:true,segment:Date.now(),total:0};
 lastActivity=Date.now();markManual(true);ui();$('leo-timer-sync').textContent='Sesión iniciada. Guardado automático durante la lectura.';
}
async function initialise(){
 const auth=await client.auth.getUser();
 if(auth.error||!auth.data.user)return;
 const permitted=await client.from('iv_dossiers').select('catalog').eq('slug',SLUG).maybeSingle();
 if(permitted.error||!permitted.data)return;
 user=auth.data.user;catalog=permitted.data.catalog||[];
 const opts=$('leo-timer-source');opts.replaceChildren();
 for(const item of catalog){
   const opt=document.createElement('option');opt.value=item.id;opt.textContent=[item.author,item.title].filter(Boolean).join(' · ');opts.append(opt);
 }
 const data=await client.from('iv_reading_sessions').select('source_id,source_title,duration_seconds,started_at').eq('owner_id',user.id).eq('dossier_slug',SLUG).order('started_at',{ascending:false}).limit(1500);
 if(!data.error)sessions=data.data||[];
 $('leo-timer-toggle').disabled=false;stats();ui();
}
$('leo-timer-toggle').addEventListener('click',toggle);
$('leo-timer-stop').addEventListener('click',stop);
$('leo-timer-source').addEventListener('change',()=>{stop();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!$('leo-timer-external').checked)pause()});
window.addEventListener('blur',()=>{if(!$('leo-timer-external').checked)pause()});
window.addEventListener('pagehide',flush);
for(const name of ['scroll','pointermove','pointerdown','keydown','touchstart'])document.addEventListener(name,()=>{lastActivity=Date.now()},{passive:true});
setInterval(()=>{
 if(!timer?.active)return;
 if(!$('leo-timer-external').checked && (document.hidden||!document.hasFocus()||Date.now()-lastActivity>180000)){pause();return}
 if(Date.now()-timer.segment>45000)flush();
 ui();
},1000);
client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){pause();user=null;timer=null;$('leo-timer-toggle').disabled=true;}});
window.addEventListener('iv:auto-segment-saved',event=>{
 const row=event.detail;
 if(!row||row.dossier_slug!==SLUG||!user)return;
 sessions.unshift(row);stats();
});
initialise().catch(console.warn);
