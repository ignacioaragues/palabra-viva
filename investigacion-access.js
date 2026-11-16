import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
const client=createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const card=document.getElementById('investigacion-title')?.closest('.project-card');
const originalCard=card?.cloneNode(true);
let run=0;
async function update(){
  if(!card || !originalCard)return;
  const i=++run;
  const auth=await client.auth.getUser();
  if(run!==i)return;
  if(!auth.data.user){restore();return;}
  const {data,error}=await client.from('iv_dossiers').select('slug').eq('slug','leo-attila').maybeSingle();
  if(run!==i)return;
  if(error || !data){restore();return;}
  card.dataset.state='live';
  const status=card.querySelector('.card-status');
  status.classList.remove('soon');
  status.textContent='Disponible · privado';
  const text=card.querySelector('p');
  if(text)text.textContent='Tu cuaderno personal de investigación, lecturas y muestras de estilo.';
  const bottom=card.querySelector('.card-bottom');
  bottom.replaceChildren();
  const a=document.createElement('a');
  a.href='./investigacion-viva/';
  a.textContent='Entrar a Investigación Viva ';
  const arrow=document.createElement('span');
  arrow.className='arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';
  a.append(arrow);bottom.append(a);
}
function restore(){
  if(!card || !originalCard)return;
  card.dataset.state='planned';
  card.replaceChildren(...Array.from(originalCard.cloneNode(true).childNodes));
}
client.auth.onAuthStateChange(event=>{
  if(event==='SIGNED_OUT'){run++;restore();}
  if(event==='SIGNED_IN')update().catch(console.warn);
});
window.addEventListener('focus',()=>update().catch(console.warn));
update().catch(console.warn);