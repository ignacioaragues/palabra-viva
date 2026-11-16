import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

// Reuse the Supabase account shared by Lengua Viva, Edición Viva and Investigación Viva.
const client = createClient('https://nzjdlqanbclsfwwstkwi.supabase.co',
  'sb_publishable_be96IsfN-3skQErkZtOtQQ_pK0OT1Y9',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

const $ = id => document.getElementById(id);
const dialog = $('pv-auth-dialog');
const trigger = $('pv-auth-trigger');
const loginForm = $('pv-login-form');
const card = $('investigacion-title')?.closest('.project-card');
const originalCard = card?.cloneNode(true);
let accessRequest = 0;

function setUser(user) {
  const signedIn = Boolean(user);
  trigger.textContent = signedIn ? 'Mi cuenta' : 'Iniciar sesión';
  $('pv-auth-guest').hidden = signedIn;
  $('pv-auth-user').hidden = !signedIn;
  $('pv-auth-email').textContent = user?.email || 'Cuenta conectada';
  if (signedIn) {
    $('pv-auth-feedback').textContent = '';
    $('pv-auth-user-feedback').textContent = '';
  }
}
function restoreResearchCard() {
  if (!card || !originalCard) return;
  card.dataset.state = 'planned';
  card.replaceChildren(...Array.from(originalCard.cloneNode(true).childNodes));
}
async function updateResearchAccess() {
  if (!card || !originalCard) return;
  const request = ++accessRequest;
  const { data: auth, error: userError } = await client.auth.getUser();
  if (request !== accessRequest) return;
  if (userError || !auth.user) { restoreResearchCard(); return; }

  // A valid session is not enough: access to this dossier is enforced by RLS.
  const { data, error } = await client.from('iv_dossiers')
    .select('slug').eq('slug', 'leo-attila').maybeSingle();
  if (request !== accessRequest) return;
  if (error || !data) { restoreResearchCard(); return; }

  card.dataset.state = 'live';
  const status = card.querySelector('.card-status');
  status.classList.remove('soon');
  status.textContent = 'Disponible · privado';
  const description = card.querySelector('p');
  if (description) description.textContent = 'Tu cuaderno personal de investigación, lecturas y muestras de estilo.';
  const bottom = card.querySelector('.card-bottom');
  bottom.replaceChildren();
  const link = document.createElement('a');
  link.href = './investigacion-viva/';
  link.textContent = 'Entrar a Investigación Viva ';
  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  link.append(arrow);
  bottom.append(link);
}
function openAccount() {
  $('pv-auth-feedback').textContent = '';
  $('pv-auth-user-feedback').textContent = '';
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  if (!$('pv-auth-guest').hidden) $('pv-login-email').focus();
}
function closeAccount() {
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}
trigger.addEventListener('click', openAccount);
$('pv-auth-close').addEventListener('click', closeAccount);
dialog.addEventListener('click', event => {
  if (event.target === dialog) closeAccount();
});
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('pv-login-submit');
  const feedback = $('pv-auth-feedback');
  button.disabled = true;
  feedback.textContent = 'Comprobando credenciales…';
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: $('pv-login-email').value.trim(),
      password: $('pv-login-password').value
    });
    if (error) throw error;
    $('pv-login-password').value = '';
    setUser(data.user);
    closeAccount();
    updateResearchAccess().catch(console.warn);
  } catch (error) {
    const message = String(error?.message || '');
    feedback.textContent = /invalid login credentials/i.test(message)
      ? 'Correo o contraseña incorrectos.'
      : /email not confirmed/i.test(message)
        ? 'Confirmá tu correo electrónico antes de ingresar.'
        : 'No pudimos iniciar sesión. Revisá tus datos o intentá nuevamente.';
  } finally {
    button.disabled = false;
  }
});
$('pv-auth-signout').addEventListener('click', async () => {
  const button = $('pv-auth-signout');
  button.disabled = true;
  $('pv-auth-user-feedback').textContent = '';
  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;
    $('pv-login-password').value = '';
    setUser(null);
    ++accessRequest;
    restoreResearchCard();
    closeAccount();
  } catch {
    $('pv-auth-user-feedback').textContent = 'No pudimos cerrar la sesión. Intentá nuevamente.';
  } finally {
    button.disabled = false;
  }
});
client.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    setUser(null);
    ++accessRequest;
    restoreResearchCard();
  } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
    setUser(session?.user || null);
    if (session?.user) updateResearchAccess().catch(console.warn);
  }
});
window.addEventListener('focus', () => updateResearchAccess().catch(console.warn));
client.auth.getUser().then(({ data, error }) => {
  if (!error) setUser(data.user);
}).catch(console.warn);
updateResearchAccess().catch(console.warn);
