import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

/* El HTML público contiene únicamente el lector vacío. El catálogo
   se descarga después de autenticar y superar la política RLS.
   No hay datos personales ni claves privilegiadas en este archivo. */
const client = createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9', {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
const DOSSIER = 'leo-attila';
const PARTIAL_TRANSLATIONS = {
  r029: { anchor: 'fragmento-prosper-451', count: 2 },
  r041: { anchor: 'fragmento-getica-222-223', count: 2 }
};

const VIS_GROUPS = [
  ['all','Todas'], ['encuentro','El encuentro'], ['attila','Atila'],
  ['leon','León I'], ['aecio','Aecio'], ['mincio','El Mincio'],
  ['epigrafia','Epigrafía y memoria']
];
const CATS = [
  ['fuentes','Fuentes contemporáneas','Prisco, Próspero, Hidacio y otros testimonios cercanos al siglo V'],
  ['leon','León I · obras completas','Dos obras: sermones y epístolas, cada colección con su propio estado y prioridad'],
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
const blank = () => ({
  version: 1, status: {}, notes: {}, units: {}, priority: {},
  visualStatus: {}, visualNotes: {}, visualPriority: {},
  sortOrder: 'priority', viewMode: 'cards', manualOrder: {}, custom: []
});
const safeUrl = url => {
  if (typeof url !== 'string') return '';
  try { return new URL(url).protocol === 'https:' ? url.slice(0, 400) : ''; }
  catch { return ''; }
};
// Las fotografías aportadas por el propietario pueden guardarse dentro del
// catálogo privado (RLS) como datos JPEG. No se publican en GitHub.
const safeVisualImageUrl = url => {
  const prefix='data:image/jpeg;base64,';
  if (typeof url === 'string' && url.startsWith(prefix) &&
      url.length <= 450000 && /^[A-Za-z0-9+/=]+$/.test(url.slice(prefix.length))) return url;
  return safeUrl(url);
};
function normalize(v) {
  const r = blank();
  if (!v || typeof v !== 'object' || v.version !== 1) return r;
  if (['priority','original'].includes(v.sortOrder)) r.sortOrder = v.sortOrder;
  if (['cards','list'].includes(v.viewMode)) r.viewMode = v.viewMode;
  if (v.manualOrder && typeof v.manualOrder === 'object' && !Array.isArray(v.manualOrder)) {
    for (const [category,ids] of Object.entries(v.manualOrder)) {
      if (!CATS.some(([id])=>id===category) || !Array.isArray(ids)) continue;
      r.manualOrder[category]=[...new Set(ids.filter(id=>
        typeof id==='string' && /^(?:r\d{3}|custom-[a-z0-9-]{1,75})$/.test(id)
      ))].slice(0,600);
    }
  }
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
  for (const [key,val] of Object.entries(v.visualStatus || {})) {
    if (/^v\d{3}$/.test(key) &&
        ['pendiente','visto','util','clave'].includes(val)) r.visualStatus[key]=val;
  }
  for (const [key,val] of Object.entries(v.visualNotes || {})) {
    if (/^v\d{3}$/.test(key) && typeof val === 'string') r.visualNotes[key]=val.slice(0,20000);
  }
  for (const [key,val] of Object.entries(v.visualPriority || {})) {
    if (/^v\d{3}$/.test(key) && ['baja','media','alta'].includes(val)) r.visualPriority[key]=val;
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
let user = null, base = [], visualBase = [], state = blank();
let visualGroup = 'all';
const openGroups = new Set(['fuentes']);
let saveTimer = null, saveSequence = Promise.resolve(), loadSequence = 0;
let privateLoaded = false;

function displayGate(message = '') {
  privateLoaded = false;
  user = null;
  base = [];
  visualBase = [];
  state = blank();
  $('work-grid')?.replaceChildren();
  $('visual-gallery')?.replaceChildren();
  $('categories')?.replaceChildren();
  $('visual-tabs')?.replaceChildren();
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
// Cada referencia cuenta como una obra. Las colecciones Sermones y Epístolas
// se guardan como dos títulos únicos, con sus propios estados y prioridades.
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
const PRIORITIES = [['baja','Baja'],['media','Media'],['alta','Alta']];
const PRIORITY_RANK = {alta:0,media:1,baja:2};
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
// La vista en lista es independiente de la prioridad por bolitas. Conserva
// un orden manual por categoría; las obras terminadas siempre se anclan arriba.
let draggedWork = null;
function fullListForCategory(category) {
  const base=allItems().filter(item=>item.cat===category);
  if(state.sortOrder==='priority') {
    base.sort((a,b)=>(PRIORITY_RANK[priorityFor(a)]??1)-(PRIORITY_RANK[priorityFor(b)]??1));
  }
  const initial=new Map(base.map((item,i)=>[item.id,i]));
  const manual=new Map((state.manualOrder[category]||[]).map((id,i)=>[id,i]));
  return base.sort((a,b)=>{
    const aDone=itemStatus(a)==='done', bDone=itemStatus(b)==='done';
    if(aDone!==bDone)return aDone?-1:1;
    const aOrder=manual.has(a.id)?manual.get(a.id):100000+initial.get(a.id);
    const bOrder=manual.has(b.id)?manual.get(b.id):100000+initial.get(b.id);
    return aOrder-bOrder;
  });
}
function reorderRelative(category,fromId,toId,after=false) {
  if(filterIsActive() || fromId===toId)return false;
  const ordered=fullListForCategory(category);
  const from=ordered.findIndex(item=>item.id===fromId);
  const to=ordered.findIndex(item=>item.id===toId);
  if(from<0||to<0||((itemStatus(ordered[from])==='done')!==(itemStatus(ordered[to])==='done')))return false;
  const original=ordered.map(item=>item.id);
  const [item]=ordered.splice(from,1);
  const targetIndex=ordered.findIndex(candidate=>candidate.id===toId);
  ordered.splice(targetIndex+(after?1:0),0,item);
  const result=ordered.map(item=>item.id);
  if(result.every((id,i)=>id===original[i]))return false;
  state.manualOrder[category]=result;
  saveState(0);
  render();
  return true;
}
function moveOneStep(item,category,direction) {
  const order=fullListForCategory(category);
  const current=order.findIndex(candidate=>candidate.id===item.id);
  const target=order[current+direction];
  if(!target)return;
  reorderRelative(category,item.id,target.id,direction>0);
}
function createListRow(item,category) {
  const row=make('div','ordered-row');
  row.dataset.status=itemStatus(item);
  row.dataset.workId=item.id;
  row.setAttribute('role','listitem');
  const noFilters=!filterIsActive();
  const ordered=fullListForCategory(category);
  const index=ordered.findIndex(candidate=>candidate.id===item.id);
  const canMoveUp=noFilters && index>0 &&
    ((itemStatus(ordered[index-1])==='done')===(itemStatus(item)==='done'));
  const canMoveDown=noFilters && index<ordered.length-1 &&
    ((itemStatus(ordered[index+1])==='done')===(itemStatus(item)==='done'));

  const handle=make('span','ordered-handle','⠿');
  handle.draggable=noFilters;
  handle.title=noFilters?'Arrastrar para cambiar el orden':'Desactivá los filtros para reordenar';
  handle.setAttribute('aria-hidden','true');
  const checkbox=make('input','ordered-checkbox');
  checkbox.type='checkbox';
  checkbox.checked=itemStatus(item)==='done';
  checkbox.setAttribute('aria-label','Marcar como terminada: '+item.title);
  const title=make('div','ordered-work-info');
  title.append(make('strong','ordered-work-title',item.title),
    make('small','ordered-work-author',item.author||''));
  const controls=make('div','ordered-controls');
  const status=make('select','ordered-status');
  status.title='Cambiar estado de lectura';
  status.setAttribute('aria-label','Estado de '+item.title);
  for(const [value,label] of [['pending','Pendiente'],['reading','En curso'],['done','Terminada']]){
    const option=make('option','',label);option.value=value;status.append(option);
  }
  status.value=itemStatus(item);
  const setStatus=value=>{
    if(itemStatus(item)===value)return;
    state.status[item.id]=value;
    saveState(0);
    render();  // Reubica automáticamente las obras terminadas arriba.
  };
  status.addEventListener('change',()=>setStatus(status.value));
  checkbox.addEventListener('change',()=>setStatus(checkbox.checked?'done':'pending'));
  controls.append(status);
  const up=make('button','ordered-step','↑');
  up.type='button';up.disabled=!canMoveUp;
  up.setAttribute('aria-label','Subir '+item.title);
  up.title='Subir una posición';
  up.addEventListener('click',()=>moveOneStep(item,category,-1));
  const down=make('button','ordered-step','↓');
  down.type='button';down.disabled=!canMoveDown;
  down.setAttribute('aria-label','Bajar '+item.title);
  down.title='Bajar una posición';
  down.addEventListener('click',()=>moveOneStep(item,category,1));
  controls.append(up,down);
  if(safeUrl(item.url)){
    const link=make('a','ordered-source','↗');
    link.href=safeUrl(item.url);link.target='_blank';link.rel='noopener noreferrer';
    link.title='Abrir fuente';link.setAttribute('aria-label','Abrir fuente de '+item.title);
    controls.append(link);
  }
  if(PARTIAL_TRANSLATIONS[item.id]){
    const info=PARTIAL_TRANSLATIONS[item.id];
    const passage=make('a','ordered-source','Pasajes ('+info.count+')');
    passage.href='#'+info.anchor;
    passage.title='Ir a las traducciones de '+item.title;
    controls.append(passage);
  }
  const notesToggle=make('button','ordered-notes-toggle',state.notes[item.id]?'Notas ·':'Notas');
  notesToggle.title='Mostrar u ocultar nota personal de '+item.title;
  notesToggle.setAttribute('aria-label','Mostrar u ocultar nota personal de '+item.title);
  notesToggle.type='button';
  const noteWrap=make('div','ordered-note');noteWrap.hidden=true;
  const area=make('textarea');
  area.rows=2;area.maxLength=20000;
  area.value=state.notes[item.id]||'';
  area.placeholder='Tus notas sobre esta obra…';
  area.setAttribute('aria-label','Notas sobre '+item.title);
  area.addEventListener('input',()=>{state.notes[item.id]=area.value;saveState(650);});
  noteWrap.append(area);
  notesToggle.addEventListener('click',()=>{
    noteWrap.hidden=!noteWrap.hidden;
    notesToggle.textContent=noteWrap.hidden?(state.notes[item.id]?'Notas ·':'Notas'):'Cerrar';
  });
  controls.append(notesToggle);
  if(item.id.startsWith('custom-')){
    const remove=make('button','ordered-remove','Quitar');
    remove.type='button';
    remove.addEventListener('click',()=>{
      if(!confirm('¿Quitar esta referencia personal?'))return;
      state.custom=state.custom.filter(x=>x.id!==item.id);
      delete state.status[item.id];delete state.notes[item.id];delete state.priority[item.id];
      for(const ids of Object.values(state.manualOrder)){
        const i=ids.indexOf(item.id);if(i>=0)ids.splice(i,1);
      }
      saveState(0);render();
    });
    controls.append(remove);
  }

  handle.addEventListener('dragstart',event=>{
    if(!noFilters){event.preventDefault();return;}
    draggedWork={id:item.id,category};
    event.dataTransfer?.setData('text/plain',item.id);
    if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
    row.classList.add('is-dragging');
  });
  handle.addEventListener('dragend',()=>{
    draggedWork=null;row.classList.remove('is-dragging');
  });
  row.addEventListener('dragover',event=>{
    if(!draggedWork || draggedWork.category!==category || draggedWork.id===item.id || !noFilters)return;
    const moving=allItems().find(x=>x.id===draggedWork.id);
    if(!moving || ((itemStatus(moving)==='done')!==(itemStatus(item)==='done')))return;
    event.preventDefault();
    if(event.dataTransfer)event.dataTransfer.dropEffect='move';
    row.classList.add('is-drag-over');
  });
  row.addEventListener('dragleave',()=>row.classList.remove('is-drag-over'));
  row.addEventListener('drop',event=>{
    row.classList.remove('is-drag-over');
    if(!draggedWork || draggedWork.category!==category)return;
    event.preventDefault();
    const movedId=draggedWork.id;
    draggedWork=null;
    const bounds=row.getBoundingClientRect();
    const after=event.clientY>bounds.top+bounds.height/2;
    reorderRelative(category,movedId,item.id,after);
  });
  row.append(handle,checkbox,title,controls,noteWrap);
  return row;
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
  const list=make('div',state.viewMode==='list'?'category-list':'category-works');
  if(state.viewMode==='list')list.setAttribute('role','list');
  if(state.viewMode==='list'){
    const finished=items.filter(item=>itemStatus(item)==='done');
    const unfinished=items.filter(item=>itemStatus(item)!=='done');
    if(finished.length){
      list.append(make('p','list-partition-label','TERMINADAS · '+finished.length));
      finished.forEach(item=>list.append(createListRow(item,id)));
    }
    if(unfinished.length){
      list.append(make('p','list-partition-label','POR LEER / EN CURSO · '+unfinished.length));
      unfinished.forEach(item=>list.append(createListRow(item,id)));
    }
  }else {
    items.forEach(item=>list.append(createCard(item)));
  }
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
  const caption = make('span','',item.sub || CATS.find(c => c[0] === item.cat)?.[1] || '');
  const priorityGroup = make('div','priority-controls');
  priorityGroup.setAttribute('role','group');
  priorityGroup.setAttribute('aria-label','Prioridad de '+item.title);
  const priorityCaption=make('span','priority-caption','PRIORIDAD');
  const dots=make('span','priority-dots');
  const dotButtons=[];
  const currentPriority=priorityFor(item);
  PRIORITIES.forEach(([value,label])=>{
    const button=make('button','priority-dot priority-'+value);
    button.type='button';
    button.title='Prioridad '+label.toLowerCase();
    button.setAttribute('aria-label',item.title+': prioridad '+label.toLowerCase());
    button.setAttribute('aria-pressed',String(currentPriority===value));
    button.dataset.value=value;
    if(currentPriority===value)button.classList.add('is-active');
    button.addEventListener('click',()=>{
      if(priorityFor(item)===value)return;
      state.priority[item.id]=value;
      saveState(0);
      dotButtons.forEach(b=>{
        const active=b.dataset.value===value;
        b.setAttribute('aria-pressed',String(active));
        b.classList.toggle('is-active',active);
      });
      if($('priority-only').checked || state.sortOrder==='priority') {
        render();
      }
    });
    dotButtons.push(button);dots.append(button);
  });
  priorityGroup.append(priorityCaption,dots);
  meta.append(caption,priorityGroup);
  const titleRow = make('div','work-title-row');
  const check = make('input','work-check'); check.type = 'checkbox';
  check.setAttribute('aria-label','Marcar como leído: '+item.title);
  const identity = make('div','');
  identity.append(make('h4','work-title',item.title),
    make('p','work-author',[item.author,item.year].filter(Boolean).join(' · ')));
  titleRow.append(check, identity);
  card.append(meta,titleRow,make('p','work-why',item.why || 'Referencia personal.'));
  const bottom = make('div','card-bottom');
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
  if(PARTIAL_TRANSLATIONS[item.id]){
    const info=PARTIAL_TRANSLATIONS[item.id];
    const passage=make('a','','Leer pasajes ('+info.count+')');
    passage.href='#'+info.anchor;
    passage.title='Abrir traducciones propias';
    actions.append(passage);
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
      for(const ids of Object.values(state.manualOrder)) {
        const index=ids.indexOf(item.id);
        if(index>=0)ids.splice(index,1);
      }
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
    bottom.append(actions);
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
    bottom.append(statusBox,actions);
    card.append(bottom,noteWrap);
  }
  return card;
}

function renderVisual() {
  if(!privateLoaded)return;
  const tabs=$('visual-tabs'),gallery=$('visual-gallery');
  tabs.replaceChildren();gallery.replaceChildren();
  for(const [id,label] of VIS_GROUPS){
    const total=id==='all'?visualBase.length:visualBase.filter(item=>item.group===id).length;
    const button=make('button','visual-tab',label+' · '+total);
    button.type='button';
    button.setAttribute('aria-pressed',String(visualGroup===id));
    button.addEventListener('click',()=>{visualGroup=id;renderVisual();});
    tabs.append(button);
  }
  const visible=visualGroup==='all'?visualBase:visualBase.filter(item=>item.group===visualGroup);
  const fragment=document.createDocumentFragment();
  for(const item of visible)fragment.append(visualCard(item));
  gallery.append(fragment);
  if(!visible.length)gallery.append(make('p','visual-empty','Todavía no hay imágenes incorporadas a este apartado.'));
  visualStatistics();
}
function visualStatistics(){
  $('visual-count').textContent=visualBase.length;
  const seen=visualBase.filter(item=>
    ['visto','util','clave'].includes(state.visualStatus[item.id])).length;
  $('visual-reviewed').textContent=seen;
}
function visualCard(item){
  const article=make('article','visual-card');
  article.dataset.group=item.group;
  article.dataset.state=state.visualStatus[item.id]||'pendiente';
  if(item.transcription || item.translation)article.classList.add('visual-card-document');
  const head=make('div','visual-card-head');
  const meta=make('span','visual-card-kind',item.kind||'Imagen histórica');
  const dotGroup=make('span','visual-card-priority');
  dotGroup.setAttribute('role','group');
  dotGroup.setAttribute('aria-label','Prioridad: '+item.title);
  const active=state.visualPriority[item.id]||'media';
  const allDots=[];
  for(const [value,label] of PRIORITIES){
    const button=make('button','priority-dot priority-'+value);
    button.type='button';
    button.title='Prioridad '+label.toLowerCase();
    button.setAttribute('aria-label','Prioridad '+label.toLowerCase()+': '+item.title);
    button.setAttribute('aria-pressed',String(active===value));
    if(active===value)button.classList.add('is-active');
    button.addEventListener('click',()=>{
      state.visualPriority[item.id]=value;
      allDots.forEach(el=>{
        el.classList.toggle('is-active',el.dataset.value===value);
        el.setAttribute('aria-pressed',String(el.dataset.value===value));
      });
      saveState(0);
    });
    button.dataset.value=value;allDots.push(button);dotGroup.append(button);
  }
  head.append(meta,dotGroup);
  const media=make('div','visual-media');
  const imageUrl=safeVisualImageUrl(item.image);
  if(imageUrl){
    const img=make('img','');
    img.src=imageUrl;
    img.alt=item.title+' — '+(item.creator||'autor desconocido');
    img.loading='lazy';img.decoding='async';
    img.addEventListener('error',()=>{
      media.replaceChildren(make('span','visual-fallback','Imagen disponible en la ficha de origen'));
      media.classList.add('visual-missing');
    });
    media.append(img);
  }else media.append(make('span','visual-fallback','Imagen disponible en la ficha de origen'));
  const details=make('div','visual-card-body');
  details.append(make('h3','',item.title),
    make('p','visual-author',[item.creator,item.date].filter(Boolean).join(' · ')));
  if(item.place)details.append(make('p','visual-place',item.place));
  if(item.note)details.append(make('p','visual-curator-note',item.note));
  let edition=null;
  if(item.transcription || item.translation){
    edition=make('details','visual-edition');
    const heading=make('summary','visual-edition-toggle','Leer inscripción · transcripción y traducción');
    const body=make('div','visual-edition-body');
    const addSection=(label,content,cls)=>{
      if(!content)return;
      const section=make('section','visual-text-section '+cls);
      section.append(make('h4','',label),make('div','visual-edition-text',content));
      body.append(section);
    };
    addSection('Transcripción de la inscripción',item.transcription,'diplomatic');
    addSection('Latín con abreviaturas desarrolladas',item.expandedLatin,'expanded');
    addSection('Traducción al español',item.translation,'translation');
    if(Array.isArray(item.editorialNotes)&&item.editorialNotes.length){
      const notes=make('section','visual-text-section editorial');
      notes.append(make('h4','','Observaciones editoriales'));
      const list=make('ul','visual-editorial-notes');
      item.editorialNotes.forEach(note=>list.append(make('li','',note)));
      notes.append(list);body.append(notes);
    }
    if(item.attribution)body.append(make('p','visual-edition-attribution',item.attribution));
    edition.append(heading,body);
  }
  const foot=make('div','visual-card-foot');
  const statusLabel=make('label','visual-status-label','Estado');
  const select=make('select','visual-status-select');
  [['pendiente','Pendiente'],['visto','Visto'],['util','Útil'],['clave','Clave']].forEach(([value,label])=>{
    const opt=make('option','',label);opt.value=value;select.append(opt);
  });
  select.value=state.visualStatus[item.id]||'pendiente';
  select.setAttribute('aria-label','Estado de '+item.title);
  select.addEventListener('change',()=>{
    state.visualStatus[item.id]=select.value;
    article.dataset.state=select.value;
    saveState(0);visualStatistics();
  });
  statusLabel.append(select);
  const actions=make('div','visual-card-actions');
  const url=safeUrl(item.source);
  if(url){
    const anchor=make('a','','Ver obra y fuente ↗');
    anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';
    actions.append(anchor);
  }
  const notesButton=make('button','','Mi nota ↓');
  notesButton.type='button';
  const notes=make('div','visual-personal-note');notes.hidden=true;
  const label=make('label','','Apuntes sobre composición, gesto, espacio o utilidad dramática');
  const area=make('textarea');area.rows=3;area.maxLength=20000;
  area.value=state.visualNotes[item.id]||'';
  area.placeholder='Qué te interesa de esta obra visual…';
  area.addEventListener('input',()=>{
    state.visualNotes[item.id]=area.value;
    saveState(650);
  });
  label.append(area);notes.append(label);
  notesButton.addEventListener('click',()=>{
    notes.hidden=!notes.hidden;notesButton.textContent=notes.hidden?'Mi nota ↓':'Ocultar nota ↑';
  });
  actions.append(notesButton);
  foot.append(statusLabel,actions);
  article.append(head,media,details);
  if(edition)article.append(edition);
  article.append(foot,notes);
  return article;
}

function render() {
  if (!privateLoaded) return;
  statistics();
  const visible=filtered();
  const visibleIds=new Set(visible.map(item=>item.id));
  const showingFiltered=filterIsActive();
  const list=$('work-grid');
  list.replaceChildren();
  const fragment=document.createDocumentFragment();
  CATS.forEach(([id,title,description],index)=>{
    const items=state.viewMode==='list'
      ? fullListForCategory(id).filter(item=>visibleIds.has(item.id))
      : visible.filter(item=>item.cat===id);
    if(state.viewMode==='cards' && state.sortOrder==='priority') {
      items.sort((a,b)=>(PRIORITY_RANK[priorityFor(a)]??1)-(PRIORITY_RANK[priorityFor(b)]??1));
    }
    if (showingFiltered && !items.length) return;
    fragment.append(buildCategory(id,title,description,items,index,showingFiltered));
  });
  list.append(fragment);
  $('visible-count').textContent=visible.length + (visible.length===1?' referencia':' referencias');
  document.querySelectorAll('[data-sort]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.sort===state.sortOrder));
  });
  document.querySelectorAll('[data-view]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.view===state.viewMode));
  });
  $('sort-toggle').hidden=state.viewMode==='list';
  $('list-order-hint').hidden=state.viewMode!=='list';
  fillCategories();
  updateCategoryProgress();
  renderVisual();
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
    .select('slug,title,catalog,visual_catalog').eq('slug',DOSSIER).maybeSingle();
  if (epoch !== loadSequence) return;
  if (error) { displayGate('No se pudo cargar el archivo privado. Revisá la conexión.'); return; }
  if (!data) { displayGate('La cuenta está conectada, pero no tiene acceso a este archivo.'); return; }
  const progress=await client.from('iv_progress').select('data')
    .eq('dossier_slug',DOSSIER).eq('owner_id',owner.id).maybeSingle();
  if (epoch !== loadSequence) return;
  if (progress.error) { displayGate('No se pudo recuperar tu progreso personal.'); return; }
  user=owner; base=Array.isArray(data.catalog)?data.catalog:[];
  visualBase=Array.isArray(data.visual_catalog)?data.visual_catalog:[];
  state=normalize(progress.data?.data);
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
document.querySelectorAll('[data-sort]').forEach(button=>{
  button.addEventListener('click',()=>{
    if(state.sortOrder===button.dataset.sort)return;
    state.sortOrder=button.dataset.sort;
    saveState(0);
    render();
  });
});
document.querySelectorAll('[data-view]').forEach(button=>{
  button.addEventListener('click',()=>{
    if(state.viewMode===button.dataset.view)return;
    state.viewMode=button.dataset.view;
    saveState(0);
    render();
  });
});
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
