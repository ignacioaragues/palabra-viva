import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

const client=createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
let generation=0;
function gate(message=''){
  ++generation;
  clearTimeout(saveTimer);
  owner=null;dossierRows=[];projectItems=[];editingId=null;draggingId=null;
  $('loading-state').hidden=true;
  $('private-app').hidden=true;
  $('gate').hidden=false;
  $('research-projects').replaceChildren();
  $('project-index-list').replaceChildren();
  $('project-add-form').hidden=true;
  $('index-sync').textContent='';
  $('footer-state').textContent='Acceso restringido';
  if(message)$('login-error').textContent=message;
}

// Los proyectos y sus relaciones de jerarquía se guardan exclusivamente en
// Supabase, dentro de una fila protegida por RLS. Solo el dossier publicado
// tiene enlace; las ideas añadidas al índice no generan páginas públicas.
const PROJECT_STATUSES=[
  ['pending','Pendiente'],['active','En curso'],['done','Terminado']
];
let owner=null, dossierRows=[], projectItems=[], saveTimer=null;
let saveQueue=Promise.resolve(), draggingId=null, editingId=null;
const newId=()=>('iv-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));
const el=(tag,cls,contents)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(contents!==undefined)node.textContent=contents;
  return node;
};
function normaliseProjects(input){
  const rows=Array.isArray(input?.items)?input.items:[];
  const unique=new Set(),out=[];
  for(const raw of rows.slice(0,500)){
    if(!raw || typeof raw!=='object')continue;
    const id=typeof raw.id==='string'?raw.id:'';
    if(!/^(?:dossier:[a-z0-9-]{1,60}|iv-[a-z0-9-]{3,80})$/.test(id) || unique.has(id))continue;
    if(typeof raw.title!=='string' || !raw.title.trim())continue;
    unique.add(id);
    out.push({
      id,title:raw.title.trim().slice(0,160),
      summary:String(raw.summary||'').slice(0,500),
      parentId:typeof raw.parentId==='string'?raw.parentId:null,
      status:PROJECT_STATUSES.some(x=>x[0]===raw.status)?raw.status:'pending',
      slug:id.startsWith('dossier:')?id.slice(8):null
    });
  }
  const byId=new Map(out.map(x=>[x.id,x]));
  // Deshacer relaciones inválidas, bucles y anidaciones de más de 2 niveles.
  for(const item of out){
    const visited=new Set([item.id]);let target=item.parentId,depth=0;
    while(target){
      if(visited.has(target)||!byId.has(target)||depth>=2){item.parentId=null;break;}
      visited.add(target);depth++;target=byId.get(target).parentId;
    }
  }
  return out;
}
function ensureDossiers(){
  // Los dossiers ya existentes no desaparecen si la lista fue modificada.
  for(const d of dossierRows){
    const id='dossier:'+d.slug;
    if(!projectItems.some(item=>item.id===id)){
      projectItems.push({id,slug:d.slug,title:d.title,
        summary:d.slug==='leo-attila'?'Fuentes históricas y dramaturgia · dossier activo':d.slug==='universales-cosmicos'?'Semántica, extrapolación y xenolingüística':d.slug==='privilegio-actualidad'?'Mundos actuales, libertad y juicio escatológico':d.slug==='estados-con-aura'?'Canon histórico de ochenta formaciones políticas singulares':'Dossier disponible',
        parentId:null,status:'active'});
    }
  }
}
function projectTreeDepth(id,visited=new Set()){
  const found=projectItems.find(item=>item.id===id);
  if(!found||!found.parentId||visited.has(id))return 0;
  visited.add(id);
  return 1+projectTreeDepth(found.parentId,visited);
}
function childrenDepth(id){
  const children=projectItems.filter(item=>item.parentId===id);
  return children.length?1+Math.max(...children.map(item=>childrenDepth(item.id))):0;
}
function parentOptions(select,project=null){
  select.replaceChildren();
  const root=el('option','', 'Proyecto principal (sin subproyecto)');
  root.value='';select.append(root);
  for(const candidate of projectItems){
    if(project && (candidate.id===project.id || isDescendant(candidate.id,project.id)))continue;
    if(projectTreeDepth(candidate.id)+(project?childrenDepth(project.id):0)>=2)continue;
    const opt=el('option','', '↳ '+candidate.title);
    opt.value=candidate.id;select.append(opt);
  }
  select.value=project?.parentId||'';
}
function isDescendant(id,ancestorId){
  const visited=new Set(),byId=new Map(projectItems.map(x=>[x.id,x]));
  let item=byId.get(id);
  while(item?.parentId && !visited.has(item.id)){
    visited.add(item.id);
    if(item.parentId===ancestorId)return true;
    item=byId.get(item.parentId);
  }
  return false;
}
function setIndexMessage(message){
  $('index-sync').textContent=message;
}
function persistIndex(delay=200){
  if(!owner)return;
  clearTimeout(saveTimer);
  setIndexMessage('Guardando…');
  const userId=owner.id;
  saveTimer=setTimeout(()=>{
    saveTimer=null;
    const snapshot=JSON.parse(JSON.stringify({version:1,items:projectItems}));
    const expected=generation;
    saveQueue=saveQueue.then(async()=>{
      if(expected!==generation)return;
      const {error}=await client.from('iv_project_index').upsert({
        owner_id:userId,data:snapshot,updated_at:new Date().toISOString()
      },{onConflict:'owner_id'});
      if(error)throw error;
      if(expected===generation)setIndexMessage('Cambios guardados en tu cuenta.');
    }).catch(error=>{
      console.warn('Error al guardar el índice privado:',error);
      if(expected===generation)setIndexMessage('No se pudo guardar. Conservá una copia antes de salir.');
    });
  },delay);
}
function siblingsOf(parentId){return projectItems.filter(item=>item.parentId===parentId);}
function moveRelative(fromId,toId,after=false){
  const moving=projectItems.find(item=>item.id===fromId);
  const dest=projectItems.find(item=>item.id===toId);
  if(!moving||!dest||moving.parentId!==dest.parentId||moving.id===dest.id)return false;
  const slots=projectItems.map((item,i)=>item.parentId===moving.parentId?i:-1).filter(x=>x!==-1);
  const siblings=slots.map(i=>projectItems[i]);
  const before=siblings.map(x=>x.id).join('|');
  const moved=siblings.splice(siblings.findIndex(x=>x.id===moving.id),1)[0];
  const index=siblings.findIndex(x=>x.id===dest.id);
  siblings.splice(index+(after?1:0),0,moved);
  if(before===siblings.map(x=>x.id).join('|'))return false;
  slots.forEach((slot,i)=>{projectItems[slot]=siblings[i]});
  persistIndex();renderIndex();
  return true;
}
function shiftProject(id,delta){
  const item=projectItems.find(x=>x.id===id);
  if(!item)return;
  const siblings=siblingsOf(item.parentId);
  const i=siblings.findIndex(x=>x.id===id);
  const target=siblings[i+delta];
  if(target)moveRelative(id,target.id,delta>0);
}
function linkFor(item){
  // Nunca abrir rutas creadas por usuarios: solo slugs permitidos por la app.
  if(!dossierRows.some(d=>d.slug===item.slug))return '';
  const allowed=['leo-attila','universales-cosmicos','privilegio-actualidad','estados-con-aura'];
  return allowed.includes(item.slug)?'./'+item.slug+'/':'';
}
function renderIndex(){
  const root=$('project-index-list');
  root.replaceChildren();
  const done=projectItems.filter(p=>p.status==='done').length;
  const active=projectItems.filter(p=>p.status==='active').length;
  $('index-count').textContent=projectItems.length+
    (projectItems.length===1?' proyecto':' proyectos')+' · '+done+
    (done===1?' terminado':' terminados');
  if(!projectItems.length){
    root.append(el('p','index-empty','Todavía no hay proyectos. Agregá el primero desde el botón superior.'));
    return;
  }
  function renderLevel(parentId,level){
    const children=siblingsOf(parentId);
    const list=el('ul','project-tree-level'+(level?' project-tree-nested':''));
    for(const item of children){
      const li=el('li','project-tree-item');
      li.dataset.projectId=item.id;
      const row=el('div','project-index-row');
      row.dataset.status=item.status;
      const handle=el('span','project-index-handle','⠿');
      handle.draggable=true;handle.title='Arrastrar para reordenar en el mismo nivel';
      handle.setAttribute('aria-hidden','true');
      const cb=el('input','project-index-checkbox');
      cb.type='checkbox';cb.checked=item.status==='done';
      cb.setAttribute('aria-label','Marcar como terminado: '+item.title);
      cb.addEventListener('change',()=>{
        item.status=cb.checked?'done':'pending';
        persistIndex();renderIndex();
      });
      const main=el('div','project-index-main');
      main.append(el('strong','project-index-title',item.title));
      if(item.summary)main.append(el('small','project-index-summary',item.summary));
      const linkUrl=linkFor(item);
      if(linkUrl){
        const link=el('a','index-project-link','Abrir dossier ↗');
        link.href=linkUrl;main.append(link);
      }
      const actions=el('div','project-index-actions');
      const statusSelect=el('select','project-index-status');
      statusSelect.setAttribute('aria-label','Estado de '+item.title);
      for(const [value,label] of PROJECT_STATUSES){
        const option=el('option','',label);
        option.value=value;statusSelect.append(option);
      }
      statusSelect.value=item.status;
      statusSelect.addEventListener('change',()=>{
        item.status=statusSelect.value;persistIndex();renderIndex();
      });
      actions.append(statusSelect);
      const sib=siblingsOf(parentId);
      const position=sib.findIndex(x=>x.id===item.id);
      for(const [delta,label,glyph] of [[-1,'Subir','↑'],[1,'Bajar','↓']]){
        const btn=el('button','project-index-move',glyph);
        btn.type='button';btn.disabled=delta===-1?position===0:position===sib.length-1;
        btn.title=label+' '+item.title;
        btn.setAttribute('aria-label',label+' '+item.title);
        btn.addEventListener('click',()=>shiftProject(item.id,delta));
        actions.append(btn);
      }
      const edit=el('button','project-index-edit','Editar');
      edit.type='button';
      edit.setAttribute('aria-expanded',String(editingId===item.id));
      edit.addEventListener('click',()=>{
        editingId=editingId===item.id?null:item.id;renderIndex();
      });
      actions.append(edit);
      row.append(handle,cb,main,actions);
      li.append(row);
      if(editingId===item.id)li.append(buildEditor(item));
      const sub=renderLevel(item.id,level+1);
      if(sub.children.length)li.append(sub);
      handle.addEventListener('dragstart',event=>{
        draggingId=item.id;
        event.dataTransfer?.setData('text/plain',item.id);
        if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
        row.classList.add('dragging');
      });
      handle.addEventListener('dragend',()=>{draggingId=null;row.classList.remove('dragging')});
      row.addEventListener('dragover',event=>{
        const dragged=projectItems.find(x=>x.id===draggingId);
        if(!dragged||dragged.parentId!==item.parentId||dragged.id===item.id)return;
        event.preventDefault();
        row.classList.add('drop-target');
      });
      row.addEventListener('dragleave',()=>row.classList.remove('drop-target'));
      row.addEventListener('drop',event=>{
        row.classList.remove('drop-target');
        if(!draggingId)return;
        event.preventDefault();
        const source=draggingId;draggingId=null;
        const box=row.getBoundingClientRect();
        moveRelative(source,item.id,event.clientY>box.top+box.height/2);
      });
      list.append(li);
    }
    return list;
  }
  root.append(renderLevel(null,0));
}
function buildEditor(item){
  const form=el('form','project-index-editor');
  const titleLabel=el('label','','Título');
  const title=el('input');title.name='title';title.maxLength=160;title.required=true;title.value=item.title;
  titleLabel.append(title);
  const parentLabel=el('label','','Jerarquía · dentro de');
  const parent=el('select');parentOptions(parent,item);parentLabel.append(parent);
  const summaryLabel=el('label','','Nota / próximo paso');
  const summary=el('textarea');summary.maxLength=500;summary.rows=2;summary.value=item.summary;
  summaryLabel.append(summary);
  const buttons=el('div','project-editor-actions');
  const apply=el('button','index-primary','Guardar cambios');apply.type='submit';
  const cancel=el('button','index-secondary','Cancelar');cancel.type='button';
  cancel.addEventListener('click',()=>{editingId=null;renderIndex()});
  buttons.append(apply,cancel);
  if(!item.slug){
    const remove=el('button','project-index-delete','Eliminar proyecto');remove.type='button';
    remove.disabled=projectItems.some(x=>x.parentId===item.id);
    remove.title=remove.disabled?'Mové sus subproyectos antes de eliminarlo':'Eliminar proyecto del índice';
    remove.addEventListener('click',()=>{
      if(projectItems.some(x=>x.parentId===item.id))return;
      if(!confirm('¿Eliminar «'+item.title+'» del índice?'))return;
      projectItems=projectItems.filter(x=>x.id!==item.id);
      editingId=null;persistIndex();renderIndex();
    });
    buttons.append(remove);
  }
  form.append(titleLabel,parentLabel,summaryLabel,buttons);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const value=title.value.trim();
    if(!value)return;
    const parentId=parent.value||null;
    // Mantener árboles sin ciclos y con profundidad máxima de 3 niveles.
    if(parentId && (parentId===item.id||isDescendant(parentId,item.id)))return;
    const newDepth=parentId?projectTreeDepth(parentId)+1:0;
    if(newDepth+childrenDepth(item.id)>2)return;
    item.title=value.slice(0,160);
    item.summary=summary.value.trim().slice(0,500);
    item.parentId=parentId;
    editingId=null;persistIndex();renderIndex();
  });
  return form;
}
function showAddForm(show){
  const form=$('project-add-form');
  form.hidden=!show;
  if(show){
    parentOptions($('project-add-parent'));
    $('project-add-title').focus();
  }else form.reset();
  $('index-add').textContent=show?'Cerrar formulario':'+ Nuevo proyecto';
}
$('index-add').addEventListener('click',()=>showAddForm($('project-add-form').hidden));
$('project-add-cancel').addEventListener('click',()=>showAddForm(false));
$('project-add-form').addEventListener('submit',event=>{
  event.preventDefault();
  const title=$('project-add-title').value.trim();
  if(!title)return;
  const parentId=$('project-add-parent').value||null;
  if(parentId && projectTreeDepth(parentId)>=2)return;
  projectItems.push({id:newId(),title:title.slice(0,160),
    summary:$('project-add-summary').value.trim().slice(0,500),
    parentId,status:'pending',slug:null});
  showAddForm(false);persistIndex(0);renderIndex();
});

function showProjects(rows){
  const root=$('research-projects');root.replaceChildren();
  const entries=Array.isArray(rows)?rows:[];
  $('project-count').textContent=entries.length+' '+(entries.length===1?'proyecto':'proyectos');
  for(const [index,item] of entries.entries()){
    const card=document.createElement('article');
    card.className='research-project-card';
    const info=document.createElement('div');info.className='research-project-info';
    const count=document.createElement('span');count.className='overline';count.textContent='PROYECTO '+String(index+1).padStart(2,'0');
    const title=document.createElement('h2');title.textContent=item.title;
    const caption=document.createElement('p');
    caption.textContent=item.slug==='leo-attila'
      ? 'Historia y fuentes del siglo V, lecturas teatrales y construcción de voces.'
      : item.slug==='universales-cosmicos'
      ? 'Semántica universal, cognición comparativa y comunicación más allá de la Tierra.'
      : item.slug==='privilegio-actualidad'
      ? 'Mundos posibles y actuales, salvación universal y justicia escatológica.'
      : item.slug==='estados-con-aura'
      ? 'Un atlas de 80 imperios, reinos, repúblicas, ciudades y proyectos políticos singulares.'
      : 'Cuaderno de investigación privado.';
    info.append(count,title,caption);
    let preview=null;
    const artwork={
      'leo-attila':['leo-attila-encuentro.svg','Encuentro de León I y Atila'],
      'universales-cosmicos':['universales-cosmicos.webp','Dos estudiosos contemplan una esfera celeste'],
      'privilegio-actualidad':['privilegio-actualidad.webp','Un filósofo contempla una balanza con dos mundos posibles'],
      'estados-con-aura':['estados-con-aura.svg','Grabado minimalista de una ciudad histórica imaginaria']
    };
    if (artwork[item.slug]) {
      preview=document.createElement('img');
      preview.className='project-engraving';
      preview.src='./assets/'+artwork[item.slug][0]+'?v=20261118-final-webp-v1';
      preview.alt=artwork[item.slug][1];
      preview.width=860;preview.height=645;
      preview.loading='lazy';
      card.classList.add('research-project-with-art');
    }
    const action=document.createElement('a');action.className='primary';
    // No cargar rutas arbitrarias desde la base de datos.
    action.href=['leo-attila','universales-cosmicos','privilegio-actualidad','estados-con-aura'].includes(item.slug)?'./'+item.slug+'/':'./';
    action.append('Abrir proyecto ');
    const icon=document.createElement('span');icon.textContent='→';action.append(icon);
    if(preview)card.append(info,preview,action);
    else card.append(info,action);
    root.append(card);
  }
  const future=document.createElement('a');
  future.className='future-project';
  future.href='#indice-proyectos';
  future.innerHTML='<span class="future-project-mark">+</span><strong>Mis próximos proyectos</strong><small>Ver el índice privado y agregar nuevas ideas</small>';
  root.append(future);
}

function renderReadingOverview(rows){
  const entries=Array.isArray(rows)?rows:[];
  const today=new Date();today.setHours(0,0,0,0);
  const sunday=new Date(today);sunday.setDate(sunday.getDate()-sunday.getDay());
  const sum=items=>items.reduce((acc,item)=>acc+(Number(item.duration_seconds)||0),0);
  const format=n=>{const h=Math.floor(n/3600),m=Math.floor(n%3600/60),sec=n%60;return h?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0')};
  $('reading-overview-today').textContent=format(sum(entries.filter(r=>new Date(r.started_at)>=today)));
  $('reading-overview-week').textContent=format(sum(entries.filter(r=>new Date(r.started_at)>=sunday)));
  $('reading-overview-total').textContent=format(sum(entries));
  $('reading-overview-sessions').textContent=String(entries.length);
  $('reading-overview-status').textContent=entries.length?'Registro sincronizado con tu cuenta.':'El contador empezará con tu primera sesión registrada.';
}

async function loadProjects(){
  const gen=++generation;
  $('loading-state').hidden=false;$('gate').hidden=true;$('private-app').hidden=true;
  const auth=await client.auth.getUser();
  if(gen!==generation)return;
  if(auth.error||!auth.data.user){gate('');return;}
  const result=await client.from('iv_dossiers').select('slug,title').order('created_at',{ascending:true});
  if(gen!==generation)return;
  if(result.error){gate('No se pudieron cargar los proyectos. Revisá la conexión.');return;}
  if(!result.data?.length){gate('Esta cuenta no tiene acceso a proyectos privados.');return;}
  const index=await client.from('iv_project_index').select('data')
    .eq('owner_id',auth.data.user.id).maybeSingle();
  if(gen!==generation)return;
  if(index.error){gate('No se pudo recuperar el índice privado de proyectos.');return;}
  owner=auth.data.user;dossierRows=result.data;
  projectItems=normaliseProjects(index.data?.data);
  ensureDossiers();
  showProjects(result.data);
  renderIndex();
  const reading=await client.from('iv_reading_sessions').select('duration_seconds,started_at,dossier_slug').eq('owner_id',owner.id).order('started_at',{ascending:false}).limit(3000);
  if(gen!==generation)return;
  if(reading.error){$('reading-overview-status').textContent='No se pudo consultar el registro de lectura.';}
  else renderReadingOverview(reading.data);
  setIndexMessage('Índice sincronizado con tu cuenta.');
  $('private-app').hidden=false;
  $('loading-state').hidden=true;
  $('gate').hidden=true;
  $('footer-state').textContent='Cuenta autorizada';
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=$('login-form').querySelector('button');button.disabled=true;
  $('login-error').textContent='';
  try{
    const {error}=await client.auth.signInWithPassword({
      email:$('login-email').value.trim(),password:$('login-password').value
    });
    if(error)throw error;
    $('login-password').value='';
    await loadProjects();
  }catch(error){
    $('login-error').textContent='No se pudo iniciar sesión. Comprobá tus datos.';
  }finally{button.disabled=false;}
});
client.auth.onAuthStateChange(event=>{
  if(event==='SIGNED_OUT')gate();
});
window.addEventListener('pageshow',event=>{if(event.persisted)loadProjects().catch(()=>gate('No se pudo verificar la sesión.'));});
loadProjects().catch(()=>gate('No se pudo conectar al servicio de acceso.'));