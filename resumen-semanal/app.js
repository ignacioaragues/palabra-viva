/* Palabra Viva · informe semanal privado (domingo-sábado).
   Lee las tablas del usuario autenticado con RLS; no almacena ni publica sus cifras.
   Las tareas automáticas de traducción nunca forman parte del tiempo activo. */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

const db = createClient(
  'https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
const $ = id => document.getElementById(id);
const AREA = [
  {key:'edition', label:'Edición Viva', color:'#607b6e'},
  {key:'languages', label:'Lengua Viva', color:'#ad8a54'},
  {key:'research', label:'Investigación Viva', color:'#80799e'}
];
const LANGUAGES = {
  francais:'Francés', 'griego-biblico':'Griego bíblico', grec:'Griego',
  cantonais:'Cantonés', latin:'Latín', italiano:'Italiano', sanskrit:'Sánscrito',
  'old-norse':'Nórdico antiguo', sumerio:'Sumerio'
};
const RESEARCH = {
  'leo-attila':'León y Atila','investigacion-viva':'Investigación Viva',
  'estados-con-aura':'Atlas de las soberanías','privilegio-actualidad':'Privilegio de la actualidad',
  'universales-cosmicos':'Universales cósmicos', alquimia:'Alquimia', garay:'Garay'
};
const DOW=['dom','lun','mar','mié','jue','vie','sáb'];
let activity = { edition:[], languages:[], research:[] };
let user = null;

function dateKey(d) {
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function sunday(offset=0) {
  const now = new Date();
  const d = new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  d.setDate(d.getDate()-d.getDay()-7*offset);
  return d;
}
function weekDays(offset) {
  const first = sunday(offset);
  return Array.from({length:7},(_,i)=>{const d = new Date(first);d.setDate(d.getDate()+i);return dateKey(d);});
}
function prettyDay(key) {
  const [y,m,d] = key.split('-').map(Number);
  return new Date(y,m-1,d,12).toLocaleDateString('es',{day:'numeric',month:'short'});
}
function prettyTime(raw) {
  const mins = Math.floor(Math.max(0,Number(raw)||0)/60);
  const h = Math.floor(mins/60), m = mins%60;
  return h ? h+' h '+(m?m+' min':'') : mins+' min';
}
function durationText(raw) {
  if (!raw) return '0 min';
  return prettyTime(raw).trim();
}
function validSeconds(n) {
  const v = Number(n);
  return Number.isFinite(v) && v>0 && v<=86400 ? v : 0;
}
function safeName(s,fallback='Sin título') {
  return typeof s==='string' && s.trim() ? s.trim().slice(0,150) : fallback;
}
function make(tag,cls,text) {
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
}

function mergeReadingDevices(rows) {
  // Varias filas pueden contener una copia sincronizada del mismo origen.
  // La unidad única es (obra, día, dispositivo); para cada clave gana el máximo.
  const works = new Map();
  for (const row of rows||[]) {
    for (const [workId,work] of Object.entries(row?.data?.works||{})) {
      if(!work||typeof work!=='object')continue;
      if(!works.has(workId))works.set(workId,{id:workId,title:safeName(work.title,workId),days:new Map()});
      const target=works.get(workId);
      if(typeof work.title==='string' && work.title.trim())target.title=safeName(work.title);
      for(const [day,devices] of Object.entries(work.days||{})) {
        if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!devices||typeof devices!=='object')continue;
        if(!target.days.has(day))target.days.set(day,new Map());
        const bucket=target.days.get(day);
        for(const [id,seconds] of Object.entries(devices)) {
          const n=validSeconds(seconds);
          if(n)bucket.set(id,Math.max(bucket.get(id)||0,n));
        }
      }
    }
  }
  return [...works.values()].map(work=>({
    id:work.id,title:work.title,
    days:Object.fromEntries([...work.days].map(([date,devs])=>[date,[...devs.values()].reduce((a,b)=>a+b,0)]))
  }));
}

function sumDays(days,week) {
  return week.reduce((sum,key)=>sum+(days[key]||0),0);
}
function aggregate(offset) {
  const week=weekDays(offset), from=week[0], until=week[6], map=Object.fromEntries(week.map(d=>[d,{edition:0,languages:0,research:0}]));
  const works=[], langs=new Map(), projects=new Map();
  let edition=0,languages=0,research=0;

  for(const work of activity.edition) {
    const secs=sumDays(work.days,week);
    if(!secs)continue;
    works.push({title:work.title,seconds:secs});
    edition+=secs;
    for(const d of week)map[d].edition+=work.days[d]||0;
  }
  for(const s of activity.languages) {
    const d=dateKey(new Date(s.started_at));
    if(d<from||d>until)continue;
    const secs=validSeconds(s.duration_seconds);
    if(!secs)continue;
    languages+=secs;map[d].languages+=secs;
    const name=LANGUAGES[s.language]||safeName(s.language,'Otro idioma');
    const old=langs.get(name)||{title:name,seconds:0,sessions:0,lessons:new Set()};
    old.seconds+=secs;old.sessions++;
    if(s.lesson_id)old.lessons.add(s.lesson_id);
    langs.set(name,old);
  }
  for(const s of activity.research) {
    const d=dateKey(new Date(s.started_at));
    if(d<from||d>until)continue;
    const secs=validSeconds(s.duration_seconds);
    if(!secs)continue;
    research+=secs;map[d].research+=secs;
    const slug=s.dossier_slug||'investigacion-viva';
    const name=RESEARCH[slug]||safeName(slug);
    const old=projects.get(slug)||{title:name,seconds:0,sessions:0,topics:new Set()};
    old.seconds+=secs;old.sessions++;
    if(s.source_title)old.topics.add(safeName(s.source_title));
    projects.set(slug,old);
  }
  const total=edition+languages+research;
  const days=week.map(d=>({...map[d],date:d,total:map[d].edition+map[d].languages+map[d].research}));
  return {
    week,total,edition,languages,research,days,
    activeDays:days.filter(d=>d.total>0).length,
    works:works.sort((a,b)=>b.seconds-a.seconds),
    langs:[...langs.values()].sort((a,b)=>b.seconds-a.seconds),
    projects:[...projects.values()].sort((a,b)=>b.seconds-a.seconds)
  };
}
function renderRanking(id,items,kind) {
  const target=$(id);target.replaceChildren();
  if(!items.length) {
    target.append(make('p','empty','Sin actividad registrada esta semana.'));
    return;
  }
  for(const [index,item] of items.slice(0,6).entries()){
    const row=make('div','rank');
    row.append(make('span','index',String(index+1).padStart(2,'0')));
    const name=make('span','name',item.title);
    if(kind==='lang') {
      const n=make('span','muted small',' · '+item.sessions+' '+(item.sessions===1?'sesión':'sesiones'));
      name.append(n);
    }
    row.append(name,make('strong','duration',durationText(item.seconds)));
    target.append(row);
  }
}
function renderStack(summary) {
  const target=$('stack'), legend=$('legend');target.replaceChildren();legend.replaceChildren();
  for(const item of AREA){
    const value=summary[item.key];
    const label=make('span','',item.label+' · '+durationText(value));
    label.style.setProperty('--dot',item.color);
    legend.append(label);
    if(value>0&&summary.total) {
      const segment=make('span');
      segment.style.width=(value/summary.total*100)+'%';
      segment.style.background=item.color;
      target.append(segment);
    }
  }
  target.setAttribute('aria-label',AREA.map(x=>x.label+': '+durationText(summary[x.key])).join('; '));
}
function renderDays(summary) {
  const root=$('days');root.replaceChildren();
  const max=Math.max(...summary.days.map(d=>d.total),60);
  summary.days.forEach((day,i)=>{
    const node=make('div','day');
    const frame=make('div','bar-frame'), bar=make('div','bar');
    bar.style.height=day.total?Math.max(2,96*day.total/max)+'px':'0';
    for(const item of AREA) {
      const v=day[item.key];
      if(!v)continue;
      const piece=make('span');
      piece.style.height=(v/day.total*100)+'%';
      piece.style.background=item.color;
      bar.append(piece);
    }
    frame.append(bar);
    node.append(make('span','day-value',day.total?Math.round(day.total/60)+'m':'–'),frame,make('span','day-label',DOW[i]));
    node.title=prettyDay(day.date)+' · '+durationText(day.total);
    node.setAttribute('aria-label',node.title);
    root.append(node);
  });
}
function render(offset) {
  const s=aggregate(offset), prev=aggregate(offset+1);
  $('period').textContent=prettyDay(s.week[0])+' – '+prettyDay(s.week[6])+' de '+s.week[6].slice(0,4);
  $('total').textContent=durationText(s.total);
  $('edition').textContent=durationText(s.edition);
  $('languages').textContent=durationText(s.languages);
  $('research').textContent=durationText(s.research);
  $('active-days').textContent=s.activeDays+' '+(s.activeDays===1?'día activo':'días activos')+' de 7';
  const delta=s.total-prev.total;
  $('comparison').textContent=prev.total===0
    ? 'No hay minutos registrados en la semana anterior para comparar.'
    : delta===0
      ? 'Mismo tiempo total que la semana anterior.'
      : (delta>0?'↑ ':'↓ ')+durationText(Math.abs(delta))+' ('+Math.abs(Math.round(delta/prev.total*100))+' %) '+(delta>0?'más':'menos')+' que la semana anterior.';
  renderStack(s);renderDays(s);
  renderRanking('top-works',s.works,'work');
  renderRanking('top-languages',s.langs,'lang');
  renderRanking('top-research',s.projects,'research');
}
function setupSelector() {
  const el=$('week');el.replaceChildren();
  for(let i=1;i<=8;i++){
    const start=weekDays(i);
    const text=i===1?'Última semana completa':i===2?'Hace dos semanas':'Hace '+i+' semanas';
    const option=make('option','',text+' · '+prettyDay(start[0])+'–'+prettyDay(start[6]));
    option.value=String(i);el.append(option);
  }
  el.addEventListener('change',()=>render(Number(el.value)));
  $('reload').addEventListener('click',()=>load(true));
}
async function load(refresh=false) {
  $('status').hidden=false;
  $('status').textContent='Cargando registros privados…';
  $('report').hidden=true;
  try {
    const auth=await db.auth.getUser();
    user=auth?.data?.user;
    if(!user){$('status').textContent='Necesitás una sesión iniciada para ver el informe.';$('signin').hidden=false;return;}
    $('signin').hidden=true;
    // No se consulta ninguna fila ajena al usuario autenticado.
    const oldest=sunday(10);oldest.setHours(0,0,0,0);
    const startISO=oldest.toISOString();
    const [ed,lv,iv]=await Promise.all([
      db.from('edition_reading_devices').select('device_id,data').eq('user_id',user.id).limit(200),
      db.from('lingua_study_sessions').select('id,language,lesson_id,duration_seconds,started_at').eq('user_id',user.id).gte('started_at',startISO).limit(10000),
      db.from('iv_reading_sessions').select('id,dossier_slug,source_title,source_id,duration_seconds,started_at').eq('owner_id',user.id).gte('started_at',startISO).limit(10000)
    ]);
    for(const result of [ed,lv,iv])if(result.error)throw result.error;
    activity = {
      edition:mergeReadingDevices(ed.data),
      languages:lv.data||[],
      research:iv.data||[]
    };
    $('status').hidden=true;
    $('report').hidden=false;
    render(Number($('week').value)||1);
  } catch(err) {
    console.error('No se pudo generar el informe semanal',err);
    $('status').hidden=false;
    $('status').textContent='No fue posible cargar todos los registros. Probá actualizar la página o revisá tu sesión.';
  }
}
setupSelector();
load();
db.auth.onAuthStateChange((event)=>{
  if(event==='SIGNED_IN'||event==='SIGNED_OUT')load();
});
