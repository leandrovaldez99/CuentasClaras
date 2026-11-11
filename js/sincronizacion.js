/* Cuentas Claras · js/sincronizacion.js
   Sincronización automática por relays de Nostr (cifrada).

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- sincronización automática ----
   Con internet, los gastos viajan solos entre los celulares del grupo: la
   invitación se manda una vez y después no hace falta mandar nada más.
   No hay servidor propio ni cuentas. Se usan relays públicos de Nostr como
   buzón: cada celular deja ahí UN paquete por viaje —el mismo de WhatsApp,
   cifrado con la clave del viaje, así que el relay guarda texto que no puede
   leer— y lo reemplaza cada vez que algo cambia. Los demás lo bajan y lo juntan
   con vjJuntar, exactamente como si se lo hubiesen pegado. Mientras la app está
   abierta, lo nuevo llega al toque.
   · El paquete se busca por una etiqueta que sale de la clave: sin la
     invitación no se puede ni encontrar.
   · Cada celular firma con una llave propia que se crea sola (no es una cuenta).
   · Se habla con varios relays a la vez: alcanza con que ande uno.
   · Sin internet no se pierde nada: se manda cuando vuelve, y el link y el QR
     siguen andando igual (y sirven con quien tenga una versión vieja).
   · Cuando un celular recibe algo nuevo, vuelve a subir su paquete: así lo de
     cada uno queda guardado también en el paquete de los otros. */
var NS_KIND = 30779;
var NS_RELAYS = (Array.isArray(window.CC_RELAYS) && window.CC_RELAYS.length) ? window.CC_RELAYS.slice(0, 8)
  : ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://nostr.mom', 'wss://relay.nostr.net'];
var NS_MAX = 40000;           // más largo que esto, algunos relays lo rechazan: va sólo lo mío
var NS_ACTIVO_DIAS = 60;      // un viaje sin movimiento en dos meses deja de sincronizar
var NS_REFRESCO = 3 * 864e5;  // cada tanto se vuelve a subir, por si un relay borró lo viejo
var ns = { con:{}, tags:{}, lista:[], clave:'', vistos:{}, espera:{}, pend:{}, ultimo:{}, ts:{}, timer:null, cierre:null, repintar:false };

function hexDe(b){ var s = ''; for(var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
function bytesDeHex(h){ var o = new Uint8Array(h.length / 2); for(var i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i*2, 2), 16); return o; }
function nsHay(){ return typeof WebSocket === 'function' && !!window.__ccNostr && vjHayCifra(); }
function nsLlave(){
  if(ns.llave) return ns.llave;
  var bien = function(x){ return /^[0-9a-f]{64}$/.test(x || ''); };
  var h = ''; try{ h = localStorage.getItem('plata-clara-nostr') || ''; }catch(e){}
  if(!bien(h)) h = S.nsk || '';
  if(!bien(h)) h = hexDe(window.__ccNostr.rnd());
  var guardada = '';
  try{ localStorage.setItem('plata-clara-nostr', h); guardada = localStorage.getItem('plata-clara-nostr'); }catch(e){}
  // si el navegador no guarda (algún WebView), la llave va con los datos de la app
  if(guardada !== h && S.nsk !== h){ S.nsk = h; save(); }
  return (ns.llave = h);
}
/* Una llave distinta para cada viaje (sale de la del celular): así, desde afuera,
   ni siquiera se puede saber que dos viajes los anotó el mismo teléfono. */
function nsLlaveDe(v){
  var k = ns.llaves || (ns.llaves = {});
  if(k[v.id]) return Promise.resolve(k[v.id]);
  return crypto.subtle.digest('SHA-256', vjBytes(nsLlave() + '|' + v.id)).then(function(h){
    var sk = new Uint8Array(h);
    return (k[v.id] = { sk:sk, pk:hexDe(window.__ccNostr.pub(sk)) });
  });
}
function vjUltimoMov(v){
  var t = v.creado || 0;
  v.gastos.forEach(function(g){ if(g.t > t) t = g.t; });
  v.miembros.forEach(function(m){ if((m.okt || 0) > t) t = m.okt; });
  if(v.cierre && v.cierre.t > t) t = v.cierre.t;
  return t;
}
/* Un viaje terminado se sigue sincronizando mientras se pueda reabrir. */
function nsActivo(v){ return !!v.clave && !v.arch && vjUltimoMov(v) > Date.now() - NS_ACTIVO_DIAS * 864e5
  && !(vjCerrado(v) && Date.now() >= v.cierre.t + VJ_REABRIR); }
function nsActivos(){ return (S.viajes || []).filter(nsActivo); }
/* Resumen de lo que hay en el viaje: si no cambió, no hace falta volver a subirlo. */
function vjHuella(v){
  var s = v.nombre + '|' + v.miembros.map(function(m){ return m.i + ':' + m.n + ':' + (m.d || '') + ':' + (m.h || '') + ':' + (m.t || 0) + ':' + (m.okt || 0); }).join(',') + '|'
    + v.gastos.map(function(g){ return g.i + ':' + g.t + ':' + g.b; }).sort().join(',')
    + (v.cierre ? '|' + v.cierre.e + ':' + v.cierre.t : '')
    + (v.mons ? '|' + v.mons.l.join('.') + ':' + v.mons.t : '');
  var h = 2166136261;
  for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + '.' + v.gastos.length + '.' + v.miembros.length;
}
function nsTag(v){
  if(ns.tags[v.id]) return Promise.resolve(ns.tags[v.id]);
  return crypto.subtle.digest('SHA-256', vjBytes('cuentas-claras|viaje|' + v.id + '|' + v.clave)).then(function(h){
    return (ns.tags[v.id] = hexDe(new Uint8Array(h)).slice(0, 40));
  });
}
function nsFirmar(v, ev){
  var k;
  return nsLlaveDe(v).then(function(kk){
    k = kk; ev.pubkey = k.pk;
    return crypto.subtle.digest('SHA-256', vjBytes(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content])));
  }).then(function(h){
    var hb = new Uint8Array(h); ev.id = hexDe(hb);
    return window.__ccNostr.sign(hb, k.sk);
  }).then(function(sig){ ev.sig = hexDe(sig); return ev; });
}
function nsQuiero(){ return nsHay() && document.visibilityState !== 'hidden' && (nsActivos().length > 0 || dvQuiere()); }
function nsAbierta(c){ return !!(c && c.ws && c.ws.readyState === 1); }
function nsListo(){ return NS_RELAYS.some(function(u){ var c = ns.con[u]; return nsAbierta(c) && c.eose; }); }
function nsEnviar(c, msg){ try{ c.ws.send(JSON.stringify(msg)); return true; }catch(e){ return false; } }

/* Abre (o cierra) las conexiones según haga falta y pide los paquetes de los viajes activos. */
function nsArrancar(){
  if(!nsQuiero()){ if(Object.keys(ns.con).length) nsCerrarTodo(); return; }
  clearTimeout(ns.cierre); ns.cierre = null;
  var vs = nsActivos();
  Promise.all(vs.map(nsTag).concat(dvActivo() ? [dvTag()] : []).concat(dvTagsExtra())).then(function(tags){
    ns.lista = tags; ns.clave = tags.slice().sort().join(',');
    NS_RELAYS.forEach(function(u){
      var c = ns.con[u];
      if(!c || (!c.reintento && (!c.ws || c.ws.readyState > 1))) nsConectar(u);
      else if(nsAbierta(c) && c.sub !== ns.clave) nsSuscribir(c);
    });
    nsPintarEstado();
  }).catch(function(){});
}
function nsConectar(u){
  var c = ns.con[u] || (ns.con[u] = { url:u, fallas:0 });
  c.reintento = null; c.eose = false; c.sub = '';
  try{ c.ws = new WebSocket(u); }catch(e){ c.ws = null; nsCayo(c); return; }
  c.ws.onopen = function(){ c.fallas = 0; nsSuscribir(c); nsPintarEstado(); };
  c.ws.onmessage = function(e){ nsMensaje(c, e.data); };
  c.ws.onclose = function(){ nsCayo(c); };
  c.ws.onerror = function(){};
}
function nsCayo(c){
  if(ns.con[c.url] !== c) return;        // la cerré yo
  c.fallas++; c.eose = false; c.sub = '';
  nsPintarEstado();
  if(!nsQuiero()) return;
  clearTimeout(c.reintento);
  c.reintento = setTimeout(function(){ c.reintento = null; if(nsQuiero() && ns.con[c.url] === c) nsConectar(c.url); },
    [2, 5, 15, 30, 60][Math.min(c.fallas, 5) - 1] * 1000);
}
function nsSuscribir(c){
  if(!ns.lista.length) return;
  c.sub = ns.clave; c.eose = false;
  nsEnviar(c, ['REQ', 'cc', { kinds:[NS_KIND], '#t':ns.lista, limit:1000 }]);
}
function nsCerrarTodo(){
  clearTimeout(ns.cierre); ns.cierre = null;
  Object.keys(ns.con).forEach(function(u){
    var c = ns.con[u]; clearTimeout(c.reintento);
    if(c.ws){ c.ws.onopen = c.ws.onmessage = c.ws.onclose = null; try{ c.ws.close(); }catch(e){} }
  });
  ns.con = {};
  nsPintarEstado();
}
function nsMensaje(c, data){
  var m; try{ m = JSON.parse(data); }catch(e){ return; }
  if(!Array.isArray(m)) return;
  if(m[0] === 'EVENT' && m[2] && m[2].kind === NS_KIND) nsRecibir(m[2]);
  else if(m[0] === 'EOSE'){
    c.eose = true;
    // lo último que subí en esta sesión también va a los relays que recién se conectan
    Object.keys(ns.ultimo).forEach(function(k){ nsEnviar(c, ['EVENT', ns.ultimo[k]]); });
    // y lo importante que quedó sin confirmar de antes (un cambio de clave, una respuesta)
    dvPendEventos().forEach(function(ev){ nsEnviar(c, ['EVENT', ev]); });
    nsPintarEstado(); nsRevisar();
  }
  else if(m[0] === 'OK') nsConfirmado(c, m[1], m[2] === true);
}
function nsRecibir(ev){
  if(typeof ev.id !== 'string' || typeof ev.content !== 'string' || ns.vistos[ev.id]) return;
  ns.vistos[ev.id] = 1;
  var pre = ev.content.slice(0, 5);
  if(pre === 'CCD1.'){ dvRecibir(ev); return; }
  if(pre === 'CCQ1.'){ dvParRecibir(ev); return; }
  if(pre === 'CCR1.'){ dvRepRecibir(ev); return; }
  if(pre === 'CCW1.'){ dvQrRecibir(ev); return; }
  var codigo = vjBuscarCodigo(ev.content);
  if(!codigo) return;
  vjAbrir(codigo).then(function(o){
    var v = viajePorId(o.g);
    if(!v || o.tipo !== 'g') return;
    var visAntes = JSON.stringify(v.vis);
    var r = vjJuntar(v, o);
    if(r.nuevos || r.cambiados || r.gente || r.cc || JSON.stringify(v.vis) !== visAntes){
      save();
      vjLlego(v, r, o.de);
      if(r.cierre) toast(vjCerrado(v) ? '"' + v.nombre + '" terminó' + (v.cierre.f.length ? '' : ': confirmaron todos')
                                      : 'Reabrieron "' + v.nombre + '"');
    }
  }).catch(function(){});
}
function nsConfirmado(c, id, ok){
  if(ok) dvConfirmoEvento(id);
  var p = ns.pend[id];
  if(!p || !ok) return;
  if(p.dv){ dvConfirmado(id, p); return; }
  var v = viajePorId(p.v);
  delete ns.pend[id];
  if(ns.espera[p.v] && ns.espera[p.v].id === id) delete ns.espera[p.v];
  if(!v || (v.sync && v.sync.pub === p.fp)) return;
  v.sync = { pub:p.fp, at:Date.now() };
  save();
  nsPintarEstado();
}
/* Sube el paquete de cada viaje activo que haya cambiado desde la última vez. */
function nsRevisarPronto(){ if(!ns || !nsHay()) return; clearTimeout(ns.timer); ns.timer = setTimeout(nsRevisar, 1200); }
function nsRevisar(){
  clearTimeout(ns.timer); ns.timer = null;
  nsArrancar();
  if(nsQuiero()) nsSubir();
}
function nsSubir(){
  if(!nsHay() || !nsListo()) return;
  nsActivos().forEach(function(v){
    if(!v.yo) return;
    var fp = vjHuella(v);
    if(v.sync && v.sync.pub === fp && Date.now() - v.sync.at < NS_REFRESCO) return;
    var e = ns.espera[v.id];
    if(e && e.fp === fp && Date.now() - e.desde < 15000) return;
    nsPublicar(v, fp);
  });
  dvSubir();
}
function nsPublicar(v, fp){
  var e = ns.espera[v.id] = { fp:fp, desde:Date.now(), id:'' }, tag = '';
  nsTag(v).then(function(t){ tag = t; return vjArmar(v, 'g', ''); })
  .then(function(cod){ return cod.length > NS_MAX ? vjArmar(v, 'g', 'mios') : cod; })
  .then(function(cod){
    // cada paquete tiene que ser "más nuevo" que el anterior, aunque salgan en el mismo segundo
    var ts = Math.max(Math.floor(Date.now() / 1000), (ns.ts[v.id] || 0) + 1);
    ns.ts[v.id] = ts;
    return nsFirmar(v, { kind:NS_KIND, created_at:ts, tags:[['d', 'cc1:' + tag], ['t', tag]], content:cod });
  }).then(function(ev){
    e.id = ev.id; ns.pend[ev.id] = { v:v.id, fp:fp }; ns.ultimo[v.id] = ev;
    ns.vistos[ev.id] = 1;
    NS_RELAYS.forEach(function(u){ var c = ns.con[u]; if(nsAbierta(c)) nsEnviar(c, ['EVENT', ev]); });
    nsPintarEstado();
  }).catch(function(){ if(ns.espera[v.id] === e) delete ns.espera[v.id]; });
}

/* Llegó algo de otro celular. Si estás mirando ese viaje, se redibuja; pero no
   mientras escribís: redibujar borraría el gasto a medio cargar. */
function vjOcupado(){
  var el = vjCont(); if(!el) return false;
  var a = document.activeElement;
  if(a && a.tagName === 'SELECT' && el.contains(a)) return true;     // una lista abierta se cerraría
  return [].some.call(el.querySelectorAll('input[type=text],textarea'), function(i){ return !i.readOnly && i.value !== i.defaultValue; });
}
function vjRefrescar(){
  if(vista !== 'viaje' && !vjEnCarga()) return;
  if(vjOcupado()){ ns.repintar = true; return; }
  // el campo donde estabas (vacío: si tuviera algo, no se redibuja) vuelve a tener el foco
  var y = window.scrollY, a = document.activeElement, id = (a && a.id && vjCont() && vjCont().contains(a)) ? a.id : '';
  renderViaje();
  try{ window.scrollTo(0, y); }catch(x){}
  if(id){ var f = document.getElementById(id); if(f) try{ f.focus({preventScroll:true}); }catch(x){} }
}
function vjLlego(v, r, de){
  if((vista !== 'viaje' && !vjEnCarga()) || (viajeSel && viajeSel !== v.id)) return;
  vjRefrescar();
  if(viajeSel && (r.nuevos || r.cambiados)){
    var n = r.nuevos + r.cambiados, quien = de && de !== v.yo ? ' de ' + vjNombre(v, de) : '';
    toast(r.nuevos && !r.cambiados ? ((r.nuevos === 1 ? 'Llegó un gasto nuevo' : 'Llegaron ' + r.nuevos + ' gastos nuevos') + quien)
      : ((n === 1 ? 'Llegó un cambio' : 'Llegaron ' + n + ' cambios') + quien));
  }
}
document.addEventListener('focusout', function(e){
  if(!ns.repintar || !e.target.closest || !e.target.closest('#viajeCuerpo, #cargaViaje')) return;
  setTimeout(function(){ if(ns.repintar && !vjOcupado()) vjRefrescar(); }, 250);
});

function nsTextoEstado(v){
  if(!nsHay()) return ['off', 'Este navegador no puede sincronizar solo: mandá tus gastos por WhatsApp.'];
  if(!nsActivo(v)) return ['off', 'Hace más de dos meses que nadie toca este viaje, así que dejó de sincronizarse solo. Si anotás algo, vuelve.'];
  var abiertas = 0, listas = 0, fallas = 0;
  NS_RELAYS.forEach(function(u){ var c = ns.con[u]; if(!c) return; if(c.fallas) fallas++; if(nsAbierta(c)){ abiertas++; if(c.eose) listas++; } });
  var pend = v.yo && (!v.sync || v.sync.pub !== vjHuella(v));
  if(!abiertas){
    if(!fallas) return ['busca', 'Conectando…'];
    return ['off', pend ? 'Sin conexión. Lo que anotaste se manda solo cuando vuelva internet.'
                        : 'Sin conexión. Cuando vuelva internet, se sincroniza solo.'];
  }
  if(!listas) return ['busca', 'Buscando lo de los demás…'];
  if(pend) return ['busca', 'Mandando lo tuyo…'];
  return ['ok', 'Al día. Con internet, los gastos van y vienen solos entre los celulares del grupo.'];
}
function nsEstadoHtml(v){
  var e = nsTextoEstado(v);
  return '<p class="vj-auto ' + e[0] + '" id="vjAuto" role="status"><i aria-hidden="true"></i><span>' + esc(e[1]) + '</span></p>';
}
function nsPintarEstado(){
  dvPintarEstado();
  var el = $('#vjAuto'); if(!el || !viajeSel) return;
  var v = viajePorId(viajeSel); if(!v) return;
  var e = nsTextoEstado(v);
  el.className = 'vj-auto ' + e[0];
  var s = el.querySelector('span'); if(s && s.textContent !== e[1]) s.textContent = e[1];
}
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'hidden'){
    // antes de irse, sube lo que haya quedado pendiente y recién después corta
    nsSubir();
    clearTimeout(ns.cierre);
    ns.cierre = setTimeout(function(){ if(document.visibilityState === 'hidden') nsCerrarTodo(); }, 3000);
  } else nsRevisar();
});
window.addEventListener('online', function(){ nsRevisar(); });
