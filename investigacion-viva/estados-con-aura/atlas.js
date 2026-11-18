import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
const client=createClient('https://nzjdlqanbclsfwwstkwi.supabase.co','sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const SLUG='estados-con-aura';
const $=id=>document.getElementById(id);
const view=document.documentElement.dataset.atlasView;
let owner=null,records=[],progress={version:1,status:{},notes:{}},saveTimer=null,saveQueue=Promise.resolve();
const TYPES=[['all','Todas las entidades'],['Imperio','Imperios'],['Otro','Reinos, repúblicas y órdenes'],['País singular','Países singulares'],['Entidad singular adicional','Otras entidades']];
let activeType='all';
const node=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e};
const link=(txt,url,cls='')=>{const a=node('a',cls,txt);a.href=url; if(/^https:\/\//.test(url)){a.target='_blank';a.rel='noopener noreferrer'}return a};
const wikiSearch=(lang,q)=>'https://'+lang+'.wikipedia.org/w/index.php?search='+encodeURIComponent(q);
const searchUrl=(base,q)=>base+encodeURIComponent(q);
const urlFor=(r)=>'./ficha.html?e='+encodeURIComponent(r.n);
const value=v=>(v===null||v===undefined||String(v).trim()===''?'No indicado en el canon':String(v).replace(/\s+/g,' ').trim());
const canonText=(r,k)=>value(r[k]).replace(/\*/g,'');
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function showGate(msg=''){owner=null;$('loading').hidden=true;$('app').hidden=true;$('gate').hidden=false;$('login-error').textContent=msg}
function showApp(){$('loading').hidden=true;$('gate').hidden=true;$('app').hidden=false}
function attachLogin(){
 const form=$('login-form');if(!form)return;
 form.addEventListener('submit',async ev=>{
  ev.preventDefault();const btn=form.querySelector('button');btn.disabled=true;$('login-error').textContent='';
  const fields=new FormData(form);
  const {error}=await client.auth.signInWithPassword({email:String(fields.get('email')||'').trim(),password:String(fields.get('password')||'')});
  btn.disabled=false;
  if(error){$('login-error').textContent='No se pudo iniciar sesión. Revisá el correo y la contraseña.';return}
  form.reset();boot();
 });
 client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')showGate()});
}
async function decodeCatalog(row){
 const pack=row?.catalog?.[0];
 if(pack?.encoding!=='gzip+base64'||typeof pack.data!=='string')throw new Error('Formato de archivo no compatible.');
 if(typeof DecompressionStream==='undefined')throw new Error('Tu navegador necesita soporte de descompresión gzip.');
 const data=Uint8Array.from(atob(pack.data),c=>c.charCodeAt(0));
 const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
 const decoded=JSON.parse(await new Response(stream).text());
 if(!Array.isArray(decoded.items)||decoded.items.length!==80)throw new Error('El inventario no está completo.');
 return decoded.items.sort((a,b)=>Number(a.n)-Number(b.n));
}
async function loadProgress(){
 const {data,error}=await client.from('iv_progress').select('data').eq('owner_id',owner.id).eq('dossier_slug',SLUG).maybeSingle();
 if(error){console.warn('Progreso no disponible:',error);return}
 if(data?.data&&typeof data.data==='object')progress={version:1,status:data.data.status||{},notes:data.data.notes||{}};
}
function persistProgress(){
 if(!owner)return;
 clearTimeout(saveTimer);
 if($('note-sync'))$('note-sync').textContent='Guardando cambios…';
 const userId=owner.id;
 saveTimer=setTimeout(()=>{
  const snapshot=JSON.parse(JSON.stringify(progress));
  saveQueue=saveQueue.then(async()=>{
   const {error}=await client.from('iv_progress').upsert({owner_id:userId,dossier_slug:SLUG,data:snapshot,updated_at:new Date().toISOString()},{onConflict:'owner_id,dossier_slug'});
   if(error)throw error;
   if($('note-sync'))$('note-sync').textContent='Guardado en tu cuenta.';
  }).catch(err=>{$('note-sync')&&($('note-sync').textContent='No se pudo guardar. Conservá una copia de tus notas.');console.warn(err)});
 },500);
}
async function boot(){
 $('loading').hidden=false;$('gate').hidden=true;$('app').hidden=true;
 try{
  const {data:auth,error:authError}=await client.auth.getUser();
  if(authError||!auth.user){showGate();return}
  owner=auth.user;
  const {data,error}=await client.from('iv_dossiers').select('catalog').eq('slug',SLUG).maybeSingle();
  if(error||!data){showGate('Esta cuenta no tiene acceso al atlas histórico.');return}
  records=await decodeCatalog(data);
  await loadProgress();
  if(view==='entity')renderEntity();
  else renderIndex();
  showApp();
 }catch(err){console.error(err);showGate('No se pudo abrir el archivo: '+(err.message||'error de lectura'))}
}
function yearNumber(r){
 const t=String(r.fechas||'').toLowerCase();
 const match=t.match(/(\d{3,4})/);
 if(match)return Number(match[1])*(/a\.\s*c\./.test(t)?-1:1);
 const cent=t.match(/siglo\s+([ivxlcdm]+)/i);if(!cent)return 100000;
 const roman=cent[1].toUpperCase();const map={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let n=0;for(let i=0;i<roman.length;i++)n+=(map[roman[i]]||0)*(map[roman[i+1]]>map[roman[i]]?-1:1);return n*100;
}
function renderIndex(){
 const wrap=$('entity-grid'),filters=$('filters');
 filters.replaceChildren();
 for(const [id,label] of TYPES){
  const btn=node('button','',label+' · '+(id==='all'?records.length:records.filter(r=>r.grupo===id).length));
  btn.type='button';btn.setAttribute('aria-pressed',String(activeType===id));
  btn.addEventListener('click',()=>{activeType=id;renderIndex()});
  filters.append(btn);
 }
 const q=fold($('search').value.trim());
 const sort=$('sort').value;
 const filtered=records.filter(r=>(activeType==='all'||r.grupo===activeType)&&(!q||fold([r.entidad,r.fechas,r.geografia,r.tipo,r.aura,r.observaciones].join(' ')).includes(q)));
 if(sort==='name')filtered.sort((a,b)=>a.entidad.localeCompare(b.entidad,'es'));
 else if(sort==='old')filtered.sort((a,b)=>yearNumber(a)-yearNumber(b)||a.n-b.n);
 wrap.replaceChildren();
 for(const r of filtered){
  const a=link('',urlFor(r),'entity-card');
  const top=node('div','card-top');
  top.append(node('small','',String(r.n).padStart(2,'0')+' / 80'),node('span','classification',value(r.tipo)));
  const heading=node('h3','',r.entidad);
  const why=node('p','',r.aura||'');
  const bottom=node('div','card-footer');
  bottom.append(node('span','',value(r.fechas)),node('strong','',progress.status?.['entity:'+r.n]==='done'?'✓ Leída':'Abrir ficha ↗'));
  a.append(top,heading,why,bottom);wrap.append(a);
 }
 $('result-count').textContent=filtered.length+' '+(filtered.length===1?'entidad':'entidades')+' · '+records.filter(r=>progress.status?.['entity:'+r.n]==='done').length+' marcadas como leídas';
 $('empty').hidden=filtered.length!==0;
}
function headingLink(label,base,query){
 return link(label,searchUrl(base,query));
}
function bibliographicCard(type,text){
 const c=node('div','reading-card'),h=node('h3','',value(text)),links=node('div','external-links');
 links.append(
  headingLink('Google Books ↗','https://books.google.com/books?q=',text),
  headingLink('WorldCat ↗','https://search.worldcat.org/search?q=',text),
  headingLink('Open Library ↗','https://openlibrary.org/search?q=',text)
 );
 c.append(node('span','reading-type',type),h,links);return c;
}
function renderEntity(){
 const n=Number(new URLSearchParams(location.search).get('e'));
 const r=records.find(e=>e.n===n);
 if(!r){$('entity-article').replaceChildren(node('p','empty','No existe esa ficha. Volvé al índice del atlas.'));return}
 document.title=r.entidad+' · Atlas de Estados con aura';
 $('crumb').textContent=r.entidad;
 $('entity-number').textContent='ENTIDAD '+String(r.n).padStart(2,'0')+' DE 80 · '+value(r.grupo).toUpperCase();
 $('entity-title').textContent=r.entidad;
 $('entity-deck').textContent=value(r.tipo);
 const meta=$('entity-meta');meta.replaceChildren();
 for(const [label,v] of [['Época',r.fechas],['Geografía',r.geografia]])meta.append(node('span','',label+': '+value(v)));
 $('entity-aura').textContent=value(r.aura);
 $('entity-note').textContent=value(r.observaciones);
 $('fallback-initial').textContent=r.entidad.charAt(0);
 $('wikipedia-main').href=wikiSearch('es',r.entidad);
 const statusKey='entity:'+r.n,btn=$('mark-status');
 function refreshStatus(){const done=progress.status?.[statusKey]==='done';btn.textContent=done?'✓ Ficha leída':'Marcar como leída';btn.classList.toggle('done',done)}
 btn.addEventListener('click',()=>{progress.status[statusKey]=progress.status?.[statusKey]==='done'?'pending':'done';refreshStatus();persistProgress()});
 refreshStatus();
 const reading=$('reading-cards');reading.replaceChildren(
  bibliographicCard('HISTORIA',canonText(r,'historia')),
  bibliographicCard('LITERATURA',canonText(r,'literatura')),
  bibliographicCard('TEXTO / OBRA DEL MUNDO HISTÓRICO',canonText(r,'texto'))
 );
 $('text-title').textContent=value(r.texto);
 $('text-links').replaceChildren(
  headingLink('Wikisource ↗','https://es.wikisource.org/w/index.php?search=',r.texto),
  headingLink('Internet Archive ↗','https://archive.org/search?query=',r.texto),
  headingLink('Google Books ↗','https://books.google.com/books?q=',r.texto)
 );
 $('film-title').textContent=value(r.audiovisual);
 $('film-links').replaceChildren(
  headingLink('IMDb ↗','https://www.imdb.com/find/?q=',r.audiovisual),
  headingLink('Ver otros registros ↗','https://www.themoviedb.org/search?query=',r.audiovisual)
 );
 $('resource-links').replaceChildren(
  resource('Wikipedia (español)','Artículo o resultados de búsqueda',wikiSearch('es',r.entidad)),
  resource('Wikipedia (English)','Lecturas y referencias complementarias',wikiSearch('en',r.entidad)),
  resource('Wikimedia Commons','Fotografías, mapas y documentos visuales',searchUrl('https://commons.wikimedia.org/w/index.php?search=',r.entidad)),
  resource('Wikidata','Identificadores, nombres y cronologías',searchUrl('https://www.wikidata.org/w/index.php?search=',r.entidad)),
  resource('Google Scholar','Investigación académica',searchUrl('https://scholar.google.com/scholar?q=',r.entidad)),
  resource('Internet Archive','Libros digitalizados y documentos',searchUrl('https://archive.org/search?query=',r.entidad))
 );
 const note=$('my-note');note.value=progress.notes?.[statusKey]||'';
 note.addEventListener('input',()=>{progress.notes[statusKey]=note.value;persistProgress()});
 const pager=$('entity-pager');pager.replaceChildren();
 const prev=records.find(e=>e.n===n-1),next=records.find(e=>e.n===n+1);
 if(prev){const a=link('',urlFor(prev));a.append(node('small','','← ANTERIOR'),node('span','',prev.entidad));pager.append(a)}else pager.append(node('span'));
 if(next){const a=link('',urlFor(next));a.append(node('small','','SIGUIENTE →'),node('span','',next.entidad));pager.append(a)}
 loadWikiImage(r).catch(err=>console.warn('Imagen opcional no disponible',err));
}
function resource(title,subtitle,url){
 const a=link('',url),strong=node('strong','',title+' ↗'),small=node('small','',subtitle);a.append(strong,small);return a;
}
async function loadWikiImage(r){
 // Mostrar solamente una miniatura asociada a una entrada enciclopédica buscada por nombre;
 // nunca presentar una imagen parecida como retrato histórico auténtico.
 const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:r.entidad,gsrnamespace:'0',gsrlimit:'3',prop:'pageimages|info',piprop:'thumbnail',pithumbsize:'900',inprop:'url',format:'json',origin:'*'});
 const response=await fetch('https://es.wikipedia.org/w/api.php?'+params.toString(),{mode:'cors'});
 if(!response.ok)return;
 const data=await response.json();
 const pages=Object.values(data?.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0));
 const original=fold(r.entidad).replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(w=>w.length>3);
 const match=pages.find(p=>{
  const title=fold(p.title||'');
  const common=original.filter(word=>title.includes(word));
  return p.thumbnail?.source&&common.length>=Math.max(1,Math.ceil(original.length/2));
 });
 if(!match)return;
 const picture=$('entity-image'),img=node('img');
 img.src=match.thumbnail.source;img.alt='Imagen asociada con el artículo «'+match.title+'» en Wikipedia';img.loading='lazy';img.referrerPolicy='no-referrer';
 img.addEventListener('error',()=>{picture.replaceChildren(node('div','image-fallback','Imagen no disponible; consultá Wikimedia Commons'))});
 picture.replaceChildren(img);
 const credit=$('entity-image-credit');credit.replaceChildren();
 credit.append('Imagen procedente del artículo ',link('«'+match.title+'» ↗',match.fullurl||wikiSearch('es',match.title)),'. Consultá allí los créditos y la licencia de la imagen.');
}
$('search')?.addEventListener('input',renderIndex);
$('sort')?.addEventListener('change',renderIndex);
attachLogin();
boot();