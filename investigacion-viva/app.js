import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

/* El HTML público contiene únicamente el lector vacío. El catálogo
   se descarga después de autenticar y superar la política RLS.
   No hay datos personales ni claves privilegiadas en este archivo. */
const client = createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9', {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
const DOSSIER = 'leo-attila';
const CATS = [
  ['fuentes','Fuentes contemporáneas','Prisco, Próspero, Hidacio y otros testimonios cercanos al siglo V'],
  ['leon','León I · obra completa','Sermones y correspondencia, con seguimiento por texto'],
  ['posteriores','Crónicas y testimonios posteriores','Jordanes, Gregorio de Tours y la memoria del período'],
  ['contexto','Contexto tardorromano','Administración, leyes, guerra e imaginarios de la Antigüedad tardía'],
  ['estudios','Estudios modernos','Historia política, cultura huna y estudios sobre León'],
  ['teatro','Mapa de lecturas teatrales','Duelo, negociación, tono y construcción de personajes']
];
const $ = id => document.getElementById(id);
const make = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};
const blank = () => ({ version: 1, status: {}, notes: {}, units: {}, priority: {}, custom: [] });
const safeUrl = url => {
  if (typeof url !== 'string') return '';
  try { return new URL(url).protocol === 'https:' ? url.slice(0, 400) : ''; }
  catch { return ''; }
};
function normalize(v) {
  const r = blank();
  if (!v || typeof v !== 'object' || v.version !== 1) return r;
  for (const [key, val] of Object.entries(v.status || {})) {
    if (/^(r\d{3}|custom-[a-z0-9-]{1,75})$/.test(key) &&
        ['pending','reading','done'].includes(val)) r.status[key] = val;
  }
  for (const [key, val] of Object.entries(v.priority || {})) {
    if (/^(r\d{3}|custom-[a-z0-9-]{1,75})$/.test(key) &&
        ['alta','media','baja'].includes(val)) r.priority[key] = val;
  }
  for (const [key, val] of Object.entries(v.notes || {})) {
    if (key.length <= 90 && typeof val === 'string') r.notes[key] = val.slice(0,20000);
  }
  for (const [key, val] of Object.entries(v.units || {})) {
    if (/^r\d{3}:\d{1,3}$/.test(key) && val === true) r.units[key] = true;
  }
  if (Array.isArray(v.custom)) {
    r.custom = v.custom.slice(0,350).filter(x => x &&
      /^custom-[a-z0-9-]{1,75}$/.test(x.id || '') &&
      typeof x.title === 'string' && CATS.some(c => c[0] === x.cat && c[0] !== 'all'))
      .map(x => ({
        id:x.id, cat:x.cat, title:x.title.slice(0,180),
        author:String(x.author||'').slice(0,120),
        why:String(x.why||'').slice(0,600),
        url:safeUrl(x.url), priority:'media', sub:'Referencia personal'
      }));
  }
  return r;
}
let user = null, base = [], state = blank();
const openGroups = new Set(['fuentes']);
let saveTimer = null, saveSequence = Promise.resolve(), loadSequence = 0;
let privateLoaded = false;

function displayGate(message = '') {
  privateLoaded = false;
  user = null;
  base = [];
  state = blank();
  $('private-app').hidden = true;
  $('loading-state').hidden = true;
  $('gate').hidden = false;
  $('footer-state').textContent = 'Acceso restringido';
  if (message) $('login-error').textContent = message;
}
function status(message) {
  const el = $('storage-message');
  if (el) el.textContent = message;
}
function allItems() { return [...base,...state.custom]; }
function isSeries(item) { return Number.isInteger(item.series) && item.series > 0; }
// Cada referencia cuenta como una obra. Las dos colecciones de León suman
// una obra cada una al porcentaje general, aunque se conserven sus casillas.
function unitCount(item) { return 1; }
function seriesReadCount(item) {
  if (!isSeries(item)) return 0;
  let count=0;
  for (let n=1; n<=item.series; n++) if (state.units[item.id+':'+n]) count++;
  return count;
}
function unitDone(item) {
  return isSeries(item) ? (seriesReadCount(item) === item.series ? 1 : 0)
    : (state.status[item.id] === 'done' ? 1 : 0);
}
function itemStatus(item) {
  if (!isSeries(item)) return state.status[item.id] || 'pending';
  const done=seriesReadCount(item);
  return done===item.series ? 'done' : done ? 'reading' : 'pending';
}
function priorityFor(item) { return state.priority[item.id] || item.priority || 'media'; }
function statistics() {
  const items = allItems();
  const total = items.reduce((a, x) => a + unitCount(x), 0);
  const done = items.reduce((a, x) => a + unitDone(x), 0);
  const active = items.filter(x => itemStatus(x) === 'reading').length;
  const percentage = total ? 100 * done / total : 0;
  $('percent').textContent = percentage.toFixed(1).replace('.',',') + '%';
  $('completion-fraction').textContent = done + ' / ' + total + ' obras';
  $('total-units').textContent = total;
  $('done-units').textContent = done;
  $('active-units').textContent = active;
  $('progress-bar').style.width = percentage + '%';
}
function saveState(delay = 280) {
  if (!user || !privateLoaded) return;
  clearTimeout(saveTimer);
  status('Guardando cambios…');
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const snapshot = structuredClone(state);
    const id = user.id;
    saveSequence = saveSequence.then(async () => {
      const { error } = await client.from('iv_progress').upsert(
        {owner_id:id, dossier_slug:DOSSIER, data:snapshot, updated_at:new Date().toISOString()},
        {onConflict:'owner_id,dossier_slug'}
      );
      if (error) throw error;
      status('Cambios sincronizados con tu cuenta.');
    }).catch(error => {
      console.warn('Investigación Viva: no se pudo guardar',error);
      status('No se pudo sincronizar. Exportá tu progreso en JSON para conservarlo.');
    });
  }, delay);
}
const roman = n => {
  let result = '';
  for (const [value,symbol] of [[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],
    [9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) {
    while (n >= value) { result += symbol; n -= value; }
  }
  return result;
};
function fillCategories() {
  const target = $('categories');
  target.replaceChildren();
  CATS.forEach(([id,title], index) => {
    const items = allItems().filter(item => item.cat === id);
    const link = make('a','category-link');
    link.href = '#seccion-' + id;
    link.append(make('span','jump-number',String(index+1).padStart(2,'0')),
      make('span','jump-title',title),
      make('span','jump-count',items.length+' referencias'),
      make('span','jump-arrow','↘'));
    link.addEventListener('click',()=>{
      openGroups.add(id);
      // Si un filtro ocultó la sección, restablecer el índice antes de navegar.
      if (!$('seccion-'+id)) {
        $('search').value='';
        $('state-filter').value='all';
        $('priority-only').checked=false;
        render();
      }
      const section = $('seccion-'+id);
      if (section) section.open = true;
    });
    target.append(link);
  });
}
function filterIsActive() {
  return !!$('search').value.trim() ||
    $('state-filter').value !== 'all' || $('priority-only').checked;
}
function filtered() {
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const term = norm($('search').value.trim());
  const chosen = $('state-filter').value, priority = $('priority-only').checked;
  return allItems().filter(item =>
    (chosen === 'all' || itemStatus(item) === chosen) &&
    (!priority || priorityFor(item) === 'alta') &&
    (!term || norm([item.title,item.author,item.why,item.sub,...(item.tags||[])].join(' ')).includes(term))
  );
}
function updateCategoryProgress() {
  for (const [id] of CATS) {
    const section = $('seccion-'+id);
    if (!section) continue;
    const items=allItems().filter(item=>item.cat===id);
    const all=items.reduce((sum,item)=>sum+unitCount(item),0);
    const read=items.reduce((sum,item)=>sum+unitDone(item),0);
    const stat=section.querySelector('.category-count');
    const meter=section.querySelector('.category-fill');
    if (stat) stat.textContent=read+' / '+all+' obras leídas';
    if (meter) meter.style.width=(all ? (read/all*100) : 0)+'%';
  }
}
function buildCategory(id,title,description,items,index,autoOpen) {
  const group=make('details','category-group');
  group.id='seccion-'+id;
  group.open=autoOpen || openGroups.has(id);
  const summary=make('summary','category-summary');
  const indexEl=make('span','category-index',String(index+1).padStart(2,'0'));
  const info=make('span','category-info');
  info.append(make('strong','',title),make('small','',description));
  const metrics=make('span','category-metrics');
  const refs=make('small','',items.length+' '+(items.length===1?'referencia':'referencias'));
  const progress=make('strong','category-count');
  const track=make('span','category-track');
  const fill=make('i','category-fill');track.append(fill);
  metrics.append(refs,progress,track);
  summary.append(indexEl,info,metrics,make('span','category-chevron','⌄'));
  const list=make('div','category-works');
  items.forEach(item=>list.append(createCard(item)));
  group.append(summary,list);
  group.addEventListener('toggle',()=>{
    // Abrir por una búsqueda no debe dejar todas las secciones abiertas luego.
    if (autoOpen) return;
    if(group.open)openGroups.add(id);else openGroups.delete(id);
  });
  return group;
}
function createCard(item) {
  const card = make('article','work-card');
  card.dataset.status = itemStatus(item);
  const meta = make('div','card-meta');
  meta.append(make('span','',item.sub || CATS.find(c => c[0] === item.cat)?.[1] || ''),
    make('span','card-priority',item.id.startsWith('custom-') ? 'AGREGADA POR VOS' : ''));
  const titleRow = make('div','work-title-row');
  const check = make('input','work-check'); check.type = 'checkbox';
  check.setAttribute('aria-label','Marcar como leído: '+item.title);
  const identity = make('div','');
  identity.append(make('h4','work-title',item.title),
    make('p','work-author',[item.author,item.year].filter(Boolean).join(' · ')));
  titleRow.append(check, identity);
  card.append(meta,titleRow,make('p','work-why',item.why || 'Referencia personal.'));
  const bottom = make('div','card-bottom');
  const priorityLabel=make('label','priority-label','Prioridad');
  const prioritySelect=make('select','priority-select');
  [['alta','Alta'],['media','Media'],['baja','Baja']].forEach(([value,label])=>{
    const option=make('option','',label);option.value=value;prioritySelect.append(option);
  });
  prioritySelect.value=priorityFor(item);
  prioritySelect.setAttribute('aria-label','Prioridad de '+item.title);
  prioritySelect.addEventListener('change',()=>{
    state.priority[item.id]=prioritySelect.value;
    saveState(0);
    if ($('priority-only').checked) render();
  });
  priorityLabel.append(prioritySelect);
  const statusBox = make('label','', 'Estado');
  const select = make('select');
  [['pending','Pendiente'],['reading','En curso'],['done','Leído']].forEach(([value,label]) => {
    const opt=make('option','',label); opt.value=value; select.append(opt);
  });
  select.value = itemStatus(item);
  statusBox.append(select);
  const actions = make('div','card-actions');
  if (safeUrl(item.url)) {
    const link = make('a','','Fuente ↗');
    link.href = safeUrl(item.url);
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    actions.append(link);
  }
  const noteBtn = make('button','','Mi nota ↓'); noteBtn.type='button';
  const noteWrap = make('div','note-area'); noteWrap.hidden = true;
  const noteLabel = make('label','','Notas de lectura');
  const noteArea = make('textarea');
  noteArea.rows = 3; noteArea.maxLength = 20000;
  noteArea.value = state.notes[item.id] || '';
  noteArea.placeholder = 'Pasajes, ideas y decisiones para la obra…';
  noteArea.addEventListener('input',()=>{state.notes[item.id]=noteArea.value; saveState(650);});
  noteLabel.append(noteArea); noteWrap.append(noteLabel);
  noteBtn.addEventListener('click',()=>{
    noteWrap.hidden = !noteWrap.hidden;
    noteBtn.textContent = noteWrap.hidden ? 'Mi nota ↓' : 'Ocultar nota ↑';
  });
  actions.append(noteBtn);
  if (item.id.startsWith('custom-')) {
    const remove = make('button','delete-entry','Quitar');remove.type='button';
    remove.addEventListener('click',()=>{
      if (!confirm('¿Quitar esta referencia personal?')) return;
      state.custom = state.custom.filter(x => x.id !== item.id);
      delete state.status[item.id];delete state.notes[item.id];delete state.priority[item.id];
      saveState(0);render();
    });
    actions.append(remove);
  }
  if (isSeries(item)) {
    check.remove();
    statusBox.remove();
    const overview = make('div','series-overview');
    const counter = make('strong');
    const percent = make('span');
    overview.append(counter,percent);
    const track = make('div','mini-meter');const fill = make('div');
    track.append(fill);
    const details = make('details','series-details');
    const summary = make('summary','','Marcar textos individuales');
    const units = make('div','series-items');
    const refresh = () => {
      const done = seriesReadCount(item);
      counter.textContent = done+' / '+item.series+' textos leídos';
      const pct = 100 * done / item.series;
      percent.textContent = pct.toFixed(1).replace('.',',')+'%';
      fill.style.width = pct+'%';
      card.dataset.status = itemStatus(item);
    };
    for (let n = 1; n <= item.series; n++) {
      const label = make('label','series-unit');
      const box = make('input'); box.type = 'checkbox';
      box.checked = !!state.units[item.id+':'+n];
      const text = make('span','',(item.seriesPrefix || 'Texto')+' '+roman(n));
      box.addEventListener('change',()=>{
        const key=item.id+':'+n;
        if (box.checked) state.units[key]=true; else delete state.units[key];
        saveState(0);refresh();statistics();updateCategoryProgress();
      });
      label.append(box,text);units.append(label);
    }
    details.append(summary,units);
    bottom.append(priorityLabel,actions);
    card.append(overview,track,details,bottom,noteWrap);
    refresh();
  } else {
    check.checked = itemStatus(item) === 'done';
    const apply = value => {
      state.status[item.id]=value;
      saveState(0);statistics();updateCategoryProgress();
      if ($('state-filter').value !== 'all') render();
      else {card.dataset.status=value;check.checked=value==='done';select.value=value;}
    };
    check.addEventListener('change',()=>apply(check.checked?'done':'pending'));
    select.addEventListener('change',()=>apply(select.value));
    bottom.append(statusBox,priorityLabel,actions);
    card.append(bottom,noteWrap);
  }
  return card;
}
function render() {
  if (!privateLoaded) return;
  statistics();
  const visible=filtered();
  const showingFiltered=filterIsActive();
  const list=$('work-grid');
  list.replaceChildren();
  const fragment=document.createDocumentFragment();
  CATS.forEach(([id,title,description],index)=>{
    const items=visible.filter(item=>item.cat===id);
    if (showingFiltered && !items.length) return;
    fragment.append(buildCategory(id,title,description,items,index,showingFiltered));
  });
  list.append(fragment);
  $('visible-count').textContent=visible.length + (visible.length===1?' referencia':' referencias');
  fillCategories();
  updateCategoryProgress();
  if(!visible.length) {
    list.append(make('p','no-results','No hay referencias que coincidan con los filtros.'));
  }
}
async function openDossier() {
  const epoch=++loadSequence;
  $('loading-state').hidden = false; $('gate').hidden = true; $('private-app').hidden=true;
  const auth=await client.auth.getUser();
  if (epoch !== loadSequence) return;
  if (auth.error || !auth.data.user) { displayGate(auth.error ? 'No se pudo verificar tu sesión.' : ''); return; }
  const owner=auth.data.user;
  const {data, error}=await client.from('iv_dossiers')
    .select('slug,title,catalog').eq('slug',DOSSIER).maybeSingle();
  if (epoch !== loadSequence) return;
  if (error) { displayGate('No se pudo cargar el archivo privado. Revisá la conexión.'); return; }
  if (!data) { displayGate('La cuenta está conectada, pero no tiene acceso a este archivo.'); return; }
  const progress=await client.from('iv_progress').select('data')
    .eq('dossier_slug',DOSSIER).eq('owner_id',owner.id).maybeSingle();
  if (epoch !== loadSequence) return;
  if (progress.error) { displayGate('No se pudo recuperar tu progreso personal.'); return; }
  user=owner; base=Array.isArray(data.catalog)?data.catalog:[];state=normalize(progress.data?.data);
  privateLoaded=true;
  $('dossier-title').textContent=data.title;
  $('loading-state').hidden=true;$('gate').hidden=true;$('private-app').hidden=false;
  $('footer-state').textContent='Cuenta autorizada';
  status('Lecturas y notas sincronizadas con tu cuenta.');
  render();
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=$('login-form').querySelector('button');
  button.disabled=true;$('login-error').textContent='';
  try {
    const {error}=await client.auth.signInWithPassword({
      email:$('login-email').value.trim(),password:$('login-password').value
    });
    if (error) throw error;
    $('login-password').value='';
    await openDossier();
  } catch (error) {
    $('login-error').textContent='No se pudo iniciar sesión. Revisá tus credenciales o recuperá el acceso desde Mi cuenta.';
  } finally {button.disabled=false;}
});
$('search').addEventListener('input',()=>render());
$('state-filter').addEventListener('change',()=>render());
$('priority-only').addEventListener('change',()=>render());
$('add-toggle').addEventListener('click',()=>{
  const form=$('custom-form');
  form.hidden=!form.hidden;
  $('add-toggle').textContent=form.hidden?'+ Agregar referencia personal':'Cerrar formulario';
});
$('custom-form').addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const row={id:'custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
    title:form.elements.title.value.trim().slice(0,180),
    author:form.elements.author.value.trim().slice(0,120),
    why:form.elements.why.value.trim().slice(0,600),
    cat:form.elements.cat.value, priority:'media',sub:'Referencia personal',
    url:safeUrl(form.elements.url.value)};
  if (!row.title) return;
  state.custom.push(row);saveState(0);form.reset();form.hidden=true;
  $('add-toggle').textContent='+ Agregar referencia personal';
  openGroups.add(row.cat);
  $('search').value='';$('state-filter').value='all';$('priority-only').checked=false;
  render();
});
$('export').addEventListener('click',()=>{
  const data={...state,exportedAt:new Date().toISOString(),project:'Investigación Viva'};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=make('a');
  a.href=url;a.download='investigacion-viva-copia-privada.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
});
$('import').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try {
    const data=JSON.parse(await file.text());
    if(data.version!==1 || typeof data.units!=='object' || typeof data.status!=='object')throw Error('Formato');
    if(!confirm('¿Reemplazar el progreso actual? Conviene exportar primero una copia.'))return;
    state=normalize(data);saveState(0);render();
  } catch { status('No se pudo importar: archivo JSON no válido.'); }
  finally{event.target.value='';}
});
// Al cerrar sesión desde otra pestaña, borrar inmediatamente los datos del DOM.
client.auth.onAuthStateChange(event=>{
  if(event==='SIGNED_OUT') {++loadSequence;clearTimeout(saveTimer);displayGate();}
});
window.addEventListener('pageshow',event=>{if(event.persisted)openDossier().catch(console.warn);});
openDossier().catch(error=>{console.warn(error);displayGate('No se pudo conectar al servicio de autenticación.');});
