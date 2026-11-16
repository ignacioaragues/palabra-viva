import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

const client=createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
let generation=0;
function gate(message=''){
  $('loading-state').hidden=true;
  $('private-app').hidden=true;
  $('gate').hidden=false;
  $('research-projects').replaceChildren();
  $('footer-state').textContent='Acceso restringido';
  if(message)$('login-error').textContent=message;
}
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
      : 'Cuaderno de investigación privado.';
    info.append(count,title,caption);
    const action=document.createElement('a');action.className='primary';
    // No cargar rutas arbitrarias desde la base de datos.
    action.href=item.slug==='leo-attila'?'./leo-attila/':'./';
    action.append('Abrir proyecto ');
    const icon=document.createElement('span');icon.textContent='→';action.append(icon);
    card.append(info,action);
    root.append(card);
  }
  const future=document.createElement('div');future.className='future-project';
  future.innerHTML='<span class="future-project-mark">+</span><strong>Próximos proyectos</strong><small>Un lugar para nuevas investigaciones.</small>';
  root.append(future);
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
  showProjects(result.data);
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
  if(event==='SIGNED_OUT'){generation++;gate();}
});
window.addEventListener('pageshow',event=>{if(event.persisted)loadProjects().catch(()=>gate('No se pudo verificar la sesión.'));});
loadProjects().catch(()=>gate('No se pudo conectar al servicio de acceso.'));