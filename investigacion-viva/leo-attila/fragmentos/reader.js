import '../../auto-reading.js?v=20261119-auto2';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
import { passages, renderPassage } from '../fragmentos.js?v=20261124-onegesius1';
import {inProgress,pending} from './inventario.js?v=20261119-greek4';

const dossier = '../';
const listing = './';
const mode = document.body.dataset.fragment;
const $ = id => document.getElementById(id);
const client = createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9', {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
function linkFor(p) { return p.id + '.html'; }
function anchor(href, text, cls = '') {
  const a = document.createElement('a');
  a.href = href; a.textContent = text;
  if (cls) a.className = cls;
  return a;
}
function showList() {
  $('reader-heading').textContent = 'Pasajes traducidos.';
  $('reader-deck').textContent = 'Fuentes parciales: cada texto tiene su propia página de lectura, con original, traducción y notas. Las fichas están vinculadas al inventario del dossier.';
  document.title = 'Pasajes traducidos · León y Atila · Investigación Viva';
  const grid = document.createElement('div');
  grid.className = 'iv-reader-index';
  for (const p of passages) {
    const card = document.createElement('article');
    card.className = 'iv-reader-index-card';
    const eyebrow = document.createElement('span'); eyebrow.className = 'overline'; eyebrow.textContent = p.author + ' · ' + p.period;
    const h = document.createElement('h2'); h.textContent = p.title;
    const work = document.createElement('p'); work.className = 'iv-reader-index-work'; work.textContent = p.work;
    const l = anchor(linkFor(p), 'Leer fragmento →', 'primary');
    card.append(eyebrow, h, work, l);
    grid.append(card);
  }
  $('reader-content').replaceChildren(grid, buildPendingInventory());
  const jump=anchor('#pendientes','Ver inventario pendiente ↓','iv-reader-jump');
  document.querySelector('.iv-reader-top')?.append(jump);
  if(location.hash==='#pendientes')requestAnimationFrame(()=>document.getElementById('pendientes')?.scrollIntoView({block:'start'}));
}
function buildPendingInventory(){
  const section=document.createElement('section');
  section.className='iv-pending-section';
  section.id='pendientes';
  const title=document.createElement('h2');title.textContent='Inventario de traducciones pendientes';
  const desc=document.createElement('p');desc.className='iv-pending-summary';
  desc.textContent='26 fuentes históricas seleccionadas para traducción parcial: 3 con pasajes ya publicados y otros por completar; 23 todavía sin traducciones. Este estado editorial no modifica tus casillas de lectura.';
  section.append(title,desc);
  const inProgressTitle=document.createElement('h3');
  inProgressTitle.textContent='En curso · 3 fuentes';
  section.append(inProgressTitle);
  const running=document.createElement('div');running.className='iv-pending-running';
  for(const item of inProgress){
    const entry=document.createElement('article');entry.className='iv-pending-entry';
    const h=document.createElement('h4');h.textContent=item.title;
    const detail=document.createElement('p');detail.textContent=item.remaining;
    const meta=document.createElement('small');meta.textContent=item.id+' · '+item.finished+' fragmentos publicados · faltan otros pasajes';
    entry.append(h,meta,detail);running.append(entry);
  }
  section.append(running);
  const untouched=document.createElement('h3');
  untouched.textContent='Por comenzar · '+pending.length+' fuentes';
  section.append(untouched);
  const groups=[['alta','Prioridad alta'],['media','Prioridad media'],['baja','Prioridad baja']];
  for(const [priority,label] of groups){
    const list=pending.filter(x=>x.priority===priority);
    const details=document.createElement('details');
    details.className='iv-pending-group';
    details.open=priority==='alta';
    const summary=document.createElement('summary');summary.textContent=label+' · '+list.length;
    details.append(summary);
    for(const item of list){
      const row=document.createElement('article');row.className='iv-pending-row';
      const heading=document.createElement('div');
      const name=document.createElement('strong');name.textContent=item.author+' · '+item.title;
      const serial=document.createElement('small');serial.textContent=item.id+' · '+item.group;
      heading.append(name,serial);
      const focus=document.createElement('p');focus.textContent=item.focus;
      row.append(heading,focus);details.append(row);
    }
    section.append(details);
  }
  const comment=document.createElement('p');comment.className='iv-pending-summary';
  comment.textContent='Las colecciones completas de León I se trabajan en Edición Viva; el teatro y la bibliografía académica permanecen en el inventario general sin entrar en esta cola de traducciones.';
  section.append(comment);
  return section;
}
function showFragment(p) {
  $('reader-heading').textContent = p.title;
  $('reader-deck').textContent = p.author + ' · ' + p.work;
  document.title = p.title + ' · Investigación Viva';
  const article = renderPassage(p);
  $('reader-content').replaceChildren(article);
  const index = passages.findIndex(x => x.id === p.id);
  const nav = document.createElement('nav');
  nav.className = 'iv-reader-pagination';
  nav.setAttribute('aria-label', 'Navegar entre fragmentos');
  if (index > 0) nav.append(anchor(linkFor(passages[index-1]), '← Fragmento anterior'));
  nav.append(anchor(listing, 'Índice de pasajes'));
  if (index + 1 < passages.length) nav.append(anchor(linkFor(passages[index+1]), 'Fragmento siguiente →'));
  $('reader-content').append(nav);
}
async function start() {
  try {
    const {data: auth, error: authError} = await client.auth.getUser();
    if (authError || !auth.user) throw Error('Iniciá sesión desde el dossier para leer estas páginas.');
    const {data, error} = await client.from('iv_dossiers').select('slug').eq('slug','leo-attila').maybeSingle();
    if (error || !data) throw Error('No se pudo verificar el acceso al dossier.');
    if (mode === 'index') showList();
    else {
      const found = passages.find(p => p.id === mode);
      if (!found) throw Error('El fragmento solicitado no existe.');
      showFragment(found);
    }
    $('loading-state').hidden = true;
    $('reader-app').hidden = false;
  } catch (error) {
    $('loading-state').hidden = true;
    $('reader-gate').hidden = false;
    $('reader-gate-message').textContent = String(error.message || 'No se pudo abrir el lector.');
  }
}
start();
