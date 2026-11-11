/* Cuentas Claras · js/cuenta.js
   La cuenta del usuario: la pantalla para entrar o crear la cuenta, la sesión y
   el recuadro "Tu cuenta" de Ajustes. El login lo resuelve Supabase Auth
   (email y contraseña); acá está la pantalla y qué pasa al entrar y al salir.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

var cuentaModo = 'cargando';   // cargando | entrar | crear | olvide | nueva | mail | error
var cuentaMsg = '', cuentaOcupado = false, cuentaSalirArmado = false;

function cuentaHayBase(){ return !!(typeof DB_URL === 'string' && DB_URL && window.supabase && window.supabase.createClient); }

/* ---- la pantalla ---- */
function cuentaMostrar(modo, msg){
  if(modo) cuentaModo = modo;
  cuentaMsg = msg || '';
  cuentaOcupado = false;
  var el = $('#cuenta'); if(!el) return;
  el.hidden = false;
  document.body.classList.add('con-cuenta');
  cuentaPintar();
}
function cuentaOcultar(){
  var el = $('#cuenta'); if(el) el.hidden = true;
  document.body.classList.remove('con-cuenta');
}
function cuentaCampo(id, etiqueta, tipo, extra){
  return '<div class="field"><label class="lab" for="' + id + '">' + etiqueta + '</label>'
    + '<input id="' + id + '" type="' + tipo + '" ' + (extra || '') + '></div>';
}
function cuentaPintar(){
  var el = $('#cuentaForm'); if(!el) return;
  var m = cuentaModo, html = '';
  var msg = '<p class="cuenta-msg" id="cuentaMsg" role="alert"' + (cuentaMsg ? '' : ' hidden') + '>' + esc(cuentaMsg) + '</p>';
  if(m === 'cargando'){
    html = '<p class="cuenta-espera"><span class="cuenta-rueda" aria-hidden="true"></span>' + esc(cuentaMsg || 'Abriendo tu cuenta…') + '</p>';
  } else if(m === 'error'){
    html = '<p class="note">' + esc(cuentaMsg || 'No pude conectarme con la base de datos.') + '</p>'
      + '<div class="rowflex"><button class="btn" type="button" data-cuenta="reintentar">Probar de nuevo</button>'
      + '<button class="btn ghost" type="button" data-cuenta="salir">Cerrar sesión</button></div>';
  } else if(m === 'mail'){
    html = '<p class="cuenta-titulo">Revisá tu email</p>'
      + '<p class="note">' + esc(cuentaMsg) + '</p>'
      + '<button class="btn ghost" type="button" data-cuenta="entrar">Volver a entrar</button>';
  } else if(m === 'olvide'){
    html = '<p class="cuenta-titulo">Recuperar la contraseña</p>'
      + '<p class="note">Poné tu email y te mando un link para elegir una contraseña nueva.</p>'
      + '<form id="fCuenta" novalidate>' + cuentaCampo('cEmail', 'Email', 'email', 'autocomplete="email" inputmode="email"') + msg
      + '<button class="btn" type="submit">Mandarme el link</button>'
      + '<button class="cuenta-link" type="button" data-cuenta="entrar">Volver</button></form>';
  } else if(m === 'nueva'){
    html = '<p class="cuenta-titulo">Elegí tu contraseña nueva</p>'
      + '<form id="fCuenta" novalidate>' + cuentaCampo('cClave', 'Contraseña nueva', 'password', 'autocomplete="new-password" minlength="6"') + msg
      + '<button class="btn" type="submit">Guardar</button></form>';
  } else {
    var crear = (m === 'crear');
    html = '<div class="seg" id="segCuenta" role="group" aria-label="Entrar o crear la cuenta">'
      + '<button type="button" data-cuenta="entrar" aria-pressed="' + (!crear) + '">Entrar</button>'
      + '<button type="button" data-cuenta="crear" aria-pressed="' + crear + '">Crear cuenta</button></div>'
      + '<form id="fCuenta" novalidate>'
      + (crear ? cuentaCampo('cNombre', 'Tu nombre', 'text', 'maxlength="28" autocomplete="name" placeholder="Como te dicen"') : '')
      + cuentaCampo('cEmail', 'Email', 'email', 'autocomplete="email" inputmode="email"')
      + cuentaCampo('cClave', 'Contraseña', 'password', 'autocomplete="' + (crear ? 'new-password' : 'current-password') + '" minlength="6"'
                    + (crear ? ' placeholder="6 caracteres o más"' : ''))
      + msg
      + '<button class="btn" type="submit">' + (crear ? 'Crear mi cuenta' : 'Entrar') + '</button>'
      + (crear ? '<p class="note cuenta-pie">Tus datos se guardan en tu cuenta y sólo los ves vos (y tu grupo familiar, si armás uno).</p>'
               : '<button class="cuenta-link" type="button" data-cuenta="olvide">Olvidé mi contraseña</button>')
      + '</form>';
  }
  // lo que estabas escribiendo no se pierde al cambiar de solapa
  var antes = {}; ['cEmail', 'cNombre'].forEach(function(id){ var i = document.getElementById(id); if(i) antes[id] = i.value; });
  el.innerHTML = html;
  Object.keys(antes).forEach(function(id){ var i = document.getElementById(id); if(i && !i.value) i.value = antes[id]; });
}
function cuentaAviso(txt){
  cuentaMsg = txt; cuentaOcupado = false;
  var p = $('#cuentaMsg'); if(p){ p.textContent = txt; p.hidden = !txt; }
  var b = $('#fCuenta button[type=submit]'); if(b) b.disabled = false;
}
/* Los errores de Supabase llegan en inglés: acá se dicen en criollo. */
function cuentaErrorTxt(e){
  var t = String((e && (e.message || e.error_description || e.code)) || e || '').toLowerCase();
  if(/invalid login|invalid_credentials/.test(t)) return 'El email o la contraseña no coinciden.';
  if(/not confirmed/.test(t)) return 'Falta confirmar el email: abrí el link que te mandamos.';
  if(/already registered|already been registered|user_already_exists/.test(t)) return 'Ya hay una cuenta con ese email. Probá entrar.';
  if(/at least 6|weak_password|password should/.test(t)) return 'La contraseña tiene que tener 6 caracteres o más.';
  if(/rate limit|too many|over_email_send_rate_limit|security purposes/.test(t)) return 'Demasiados intentos seguidos. Esperá un rato y probá de nuevo.';
  if(/valid email|invalid format|email_address_invalid/.test(t)) return 'Ese email no parece válido.';
  if(/signups? (are )?(not allowed|disabled)/.test(t)) return 'Por ahora no se pueden crear cuentas nuevas.';
  if(/failed to fetch|network|load failed/.test(t)) return 'No hay conexión. Revisá internet y probá de nuevo.';
  return 'No se pudo. Probá de nuevo en un rato.';
}

/* ---- entrar, crear la cuenta, recuperar la contraseña ---- */
function cuentaEnviar(){
  if(cuentaOcupado || !db) return;
  var email = (($('#cEmail') || {}).value || '').trim(), clave = ($('#cClave') || {}).value || '';
  var nombre = (($('#cNombre') || {}).value || '').trim().replace(/\s+/g, ' ').slice(0, 28);
  var m = cuentaModo;
  if(m !== 'nueva' && !/^\S+@\S+\.\S+$/.test(email)){ cuentaAviso('Poné tu email.'); var ce = $('#cEmail'); if(ce) ce.focus(); return; }
  if(m !== 'olvide' && clave.length < 6){ cuentaAviso('La contraseña tiene que tener 6 caracteres o más.'); var cc = $('#cClave'); if(cc) cc.focus(); return; }
  if(m === 'crear' && !nombre){ cuentaAviso('Poné tu nombre.'); var cn = $('#cNombre'); if(cn) cn.focus(); return; }
  cuentaOcupado = true; cuentaAviso(''); cuentaOcupado = true;
  var b = $('#fCuenta button[type=submit]'); if(b) b.disabled = true;
  var p;
  if(m === 'crear') p = db.auth.signUp({ email:email, password:clave, options:{ data:{ nombre:nombre }, emailRedirectTo:cuentaVolverA() } });
  else if(m === 'olvide') p = db.auth.resetPasswordForEmail(email, { redirectTo:cuentaVolverA() });
  else if(m === 'nueva') p = db.auth.updateUser({ password:clave });
  else p = db.auth.signInWithPassword({ email:email, password:clave });
  p.then(function(r){
    if(r.error) throw r.error;
    var d = r.data || {};
    if(m === 'olvide'){ cuentaMostrar('mail', 'Si hay una cuenta con ' + email + ', te llegó un link para elegir una contraseña nueva.'); return; }
    if(m === 'nueva'){ db.auth.getSession().then(function(x){ var s = x.data && x.data.session; if(s) cuentaEntro(s); else cuentaMostrar('entrar', 'Listo. Entrá con tu contraseña nueva.'); }); return; }
    if(d.session){ cuentaEntro(d.session); return; }
    // cuenta creada pero falta confirmar el email (o ya existía: Supabase no lo dice, a propósito)
    if(m === 'crear'){
      if(d.user && d.user.identities && !d.user.identities.length){ cuentaAviso('Ya hay una cuenta con ese email. Probá entrar.'); return; }
      cuentaMostrar('mail', 'Te mandé un link a ' + email + ' para confirmar la cuenta. Abrilo y después entrá con tu contraseña.');
      return;
    }
    cuentaAviso('No se pudo entrar. Probá de nuevo.');
  }).catch(function(e){ cuentaAviso(cuentaErrorTxt(e)); });
}
// adónde vuelve el link del email: a esta misma página (si está publicada)
function cuentaVolverA(){ return /^https?:$/.test(location.protocol) ? location.origin + location.pathname : undefined; }

/* Ya hay sesión: se ve de quién son los datos de este navegador y se trae lo de la base. */
function cuentaEntro(ses){
  var u = ses.user, quien = '';
  try{ quien = localStorage.getItem(DB_LS_QUIEN) || ''; }catch(e){}
  if(dbSes.usuario === u.id && dbEst.listo){ cuentaOcultar(); return; }
  dbSes.usuario = u.id; dbSes.email = u.email || '';
  var conocido = (quien === u.id) && dbLeerCache();
  if(!conocido){
    // otro usuario (o la primera vez): lo que hubiera guardado en este navegador no es suyo
    dbSes.espacio = ''; dbOlvidarLocal();
    try{ localStorage.setItem(DB_LS_QUIEN, u.id); }catch(e){}
    fillSelects(); render();
    cuentaMostrar('cargando', 'Trayendo tus datos…');
  } else cuentaOcultar();                               // ya tiene sus datos acá: entra directo y se actualiza por atrás
  modo = 'base';
  dbTraer().then(function(){ cuentaOcultar(); renderAjustes(); nsRevisar(); })
    .catch(function(e){
      if(conocido){ dbPintarEstado(); return; }         // sin conexión: sigue con lo que tiene en este navegador
      cuentaMostrar('error', /sin_perfil|sin_espacio/.test(String(e && e.message))
        ? 'Tu cuenta existe pero no tiene sus datos armados. Avisale a quien administra la app.'
        : 'No pude traer tus datos. Revisá la conexión y probá de nuevo.');
    });
}
/* Se cerró la sesión: este navegador se queda sin los datos. */
function cuentaSalio(){
  if(dbSes.canal){ try{ db.removeChannel(dbSes.canal); }catch(e){} }
  dbSes = { usuario:'', email:'', espacio:'', propio:'', persona:'', creador:'', codigo:'', miembros:[], canal:null };
  clearTimeout(dbEst.tSubir); clearTimeout(dbEst.tTraer);
  dbOlvidarLocal();
  try{ localStorage.removeItem(DB_LS_QUIEN); }catch(e){}
  cuentaSalirArmado = false;
  fillSelects(); render(); renderAjustes();
  cuentaMostrar('entrar');
}
function cuentaSalir(){
  if(!db) return;
  // si quedó algo sin subir, se avisa una vez antes de perderlo
  var falta = dbEst.pendiente && dbEst.error;
  if(falta && !cuentaSalirArmado){
    cuentaSalirArmado = true; cuentaPintarAjustes();
    toast('Hay cambios que todavía no se subieron. Si cerrás la sesión ahora, se pierden. Tocá otra vez para cerrarla igual');
    return;
  }
  var p = (dbActiva() && dbEst.listo && !falta) ? dbEmpujarYa().catch(function(){}) : Promise.resolve();
  p.then(function(){ return db.auth.signOut(); }).catch(function(){}).then(cuentaSalio);
}

/* ---- el recuadro "Tu cuenta", en Ajustes ---- */
function cuentaPintarAjustes(){
  var el = $('#cuentaAjustes'); if(!el) return;
  if(!db || !dbSes.usuario){
    el.innerHTML = '<p class="note" style="margin:0">Esta copia de la app no está conectada a una base de datos: lo que cargues queda sólo en este navegador.</p>';
    return;
  }
  var e = dbEstadoTxt();
  el.innerHTML = '<p class="vj-auto ' + e[0] + '" id="cuentaEstado" role="status"><i aria-hidden="true"></i><span>' + esc(e[1]) + '</span></p>'
    + '<p class="note" style="margin:8px 0 12px">Entraste como <b>' + esc(dbSes.email) + '</b>. Tus datos están en tu cuenta: los ves en cualquier navegador donde entres.</p>'
    + '<button class="btn ghost sm' + (cuentaSalirArmado ? ' peligro' : '') + '" type="button" data-cuenta="salir">'
    + (cuentaSalirArmado ? 'Cerrar sesión igual' : 'Cerrar sesión') + '</button>';
}

document.addEventListener('click', function(e){
  var b = e.target.closest ? e.target.closest('[data-cuenta]') : null; if(!b) return;
  var q = b.getAttribute('data-cuenta');
  if(q === 'entrar' || q === 'crear' || q === 'olvide'){ cuentaMostrar(q); return; }
  if(q === 'salir'){ cuentaSalir(); return; }
  if(q === 'reintentar'){
    cuentaMostrar('cargando', 'Trayendo tus datos…');
    db.auth.getSession().then(function(r){ var s = r.data && r.data.session; if(s){ dbEst.listo = false; cuentaEntro(s); } else cuentaMostrar('entrar'); })
      .catch(function(){ cuentaMostrar('error'); });
  }
});
document.addEventListener('submit', function(e){
  if(e.target && e.target.id === 'fCuenta'){ e.preventDefault(); cuentaEnviar(); }
});

/* ---- arranque: ¿hay una sesión abierta en este navegador? ---- */
function cuentaArrancar(){
  if(!cuentaHayBase()){ cuentaOcultar(); cuentaPintarAjustes(); return; }   // sin base configurada: la app anda sola, en este navegador
  try{ db = window.supabase.createClient(DB_URL, DB_CLAVE); }
  catch(e){ db = null; cuentaMostrar('error'); return; }
  db.auth.onAuthStateChange(function(ev){
    // (no se puede llamar a Supabase desde adentro de este aviso: por eso el setTimeout)
    setTimeout(function(){
      if(ev === 'PASSWORD_RECOVERY') cuentaMostrar('nueva');
      else if(ev === 'SIGNED_OUT' && dbSes.usuario) cuentaSalio();
    }, 0);
  });
  db.auth.getSession().then(function(r){
    var s = r.data && r.data.session;
    if(s) cuentaEntro(s); else if(cuentaModo === 'cargando') cuentaMostrar('entrar');
  }).catch(function(){ cuentaMostrar('entrar'); });
}
