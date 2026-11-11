/* Cuentas Claras · js/dispositivos.js
   Vincular dispositivos: llaves, códigos, QR y el intercambio de datos entre celulares.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   tus dispositivos: el celular y la compu con los mismos datos
   ============================================================
   Usa los mismos relays que los viajes. Cada dispositivo vinculado deja ahí sus
   datos en paquetes cifrados con la clave del vínculo, y los demás los juntan
   con los suyos. Esa clave no se muestra nunca: el código y el QR para sumar un
   dispositivo son un pase de un solo uso que vence a los 10 minutos (ver "el
   código de un solo uso" más abajo).

   · Nada se reemplaza entero: los datos se parten en "ítems" (cada movimiento,
     cada cuota, cada meta, cada aporte, cada fijo, cada pase, cada viaje, y cada
     parte de la configuración) y cada ítem guarda la hora de su último cambio.
     Al juntar, de cada ítem queda la versión más nueva. Dos gastos cargados en
     dos lugares son dos ítems distintos: quedan los dos.
   · Los cambios no se anotan a mano en cada rincón de la app: `dvMarcar` compara
     una huella de cada ítem con la que tenía la última vez que se guardó. Si
     cambió, le pone la hora de ahora; si desapareció, deja una marca de borrado,
     que es lo que hace que un borrado también viaje.
   · Al vincular, lo que ya había en cada lado se junta: al principio no hay
     marcas de borrado, así que no se puede borrar nada. La configuración que
     sigue igual que la de fábrica entra con hora 1, así las categorías, medios o
     cuentas de verdad del otro le ganan a las de un dispositivo recién estrenado.
   · Los viajes no se pisan: se juntan como entre los celulares del grupo.
   · Los paquetes van por partes (la configuración, las cuotas y fijos, las
     metas, cada quincena de movimientos, cada viaje) para que ninguno pase el
     tamaño que aceptan los relays, y sólo se vuelve a subir la parte que cambió.
   · Antes de vincular se guarda una copia de todo. */
var DV_MAX = 45000;
var DV_FUERA = ['v','updatedAt','nsk','sy','tx','planes','metas','fijos','pases','hx','viajes','vjHist','vjArch'];
var DV_ANTES = 'plata-clara-antes-de-vincular', DV_RESP = 'plata-clara-respaldo-sync';
var dvBase = null, dvPend = null, dvUI = null, dvConf = null, dvTimer = null, dvRepintar = false, dvLlegoDe = '';

function dvLink(){ return (S && S.sy && S.sy.link) || null; }
function dvActivo(){ return !!dvLink(); }
function dvLimpio(o){
  if(!o || typeof o !== 'object' || !o.link || !dvLinkOk(o.link)) return null;
  // sin su par de llaves y la lista de dispositivos no es un vínculo de esta versión
  if(!o.yo || typeof o.yo.pub !== 'string' || typeof o.yo.priv !== 'string') return null;
  var mi = dvMiembrosLimpios(o.miembros); if(!mi[o.yo.pub]) return null;
  var h = {};
  if(o.h && typeof o.h === 'object') Object.keys(o.h).forEach(function(k){
    var r = o.h[k];
    if(Array.isArray(r) && (typeof r[0] === 'string' || r[0] === null) && Number(r[1]) > 0) h[k] = [r[0], Number(r[1]), String(r[2] || 'b')];
  });
  var obj = function(x){ return (x && typeof x === 'object' && !Array.isArray(x)) ? x : {}; };
  var viejos = (Array.isArray(o.viejos) ? o.viejos : []).filter(function(v){ return dvLinkOk(v) && Number(v.hasta) > Date.now(); })
    .map(function(v){ return { id:v.id, k:v.k, hasta:Number(v.hasta) }; }).slice(-4);
  return { link:{ id:o.link.id, k:o.link.k, desde:Number(o.link.desde) || 0 }, yo:{ pub:o.yo.pub, priv:o.yo.priv }, miembros:mi,
           h:h, pub:obj(o.pub), vistos:obj(o.vistos), viejos:viejos, repTs:Number(o.repTs) || 0, pendEv:obj(o.pendEv),
           marcado:o.marcado ? 1 : 0, base:Number(o.base) || 0, solo:dvSoloLimpio(o.solo) };
}
/* v240: lo que tenía este dispositivo antes de sumarse a un grupo que "arranca de
   cero". Son claves de ítems (tx:…, pl:…): quedan acá, se ven acá y no viajan. */
function dvSoloLimpio(o){
  if(!o || typeof o !== 'object' || Array.isArray(o)) return undefined;
  var r = {}, n = 0;
  Object.keys(o).forEach(function(k){ if(o[k] && /^[a-z]{2}:/.test(k) && k.slice(0, 2) !== 'c:'){ r[k] = 1; n++; } });
  return n ? r : undefined;
}
function dvSoloAhora(){
  var r = {}, n = 0, it = dvItems();
  Object.keys(it).forEach(function(k){ if(k.slice(0, 2) !== 'c:'){ r[k] = 1; n++; } });
  return n ? r : undefined;
}
function esSolo(x){
  var so = S.sy && S.sy.solo; if(!so || !x || !x.id) return false;
  return !!(so['tx:' + x.id] || so['pl:' + x.id] || so['fi:' + x.id] || so['pa:' + x.id] || so['hx:' + x.id]);
}
/* JSON con las claves ordenadas: la huella no puede depender del orden en que
   quedaron las claves de un objeto. */
function dvEstable(x){
  if(x === null || x === undefined) return 'null';
  if(typeof x !== 'object') return JSON.stringify(x);
  if(Array.isArray(x)) return '[' + x.map(dvEstable).join(',') + ']';
  return '{' + Object.keys(x).sort().filter(function(k){ return x[k] !== undefined; })
    .map(function(k){ return JSON.stringify(k) + ':' + dvEstable(x[k]); }).join(',') + '}';
}
function dvHash(x){
  var s = dvEstable(x), a = 2166136261, b = 5381;
  for(var i = 0; i < s.length; i++){ var c = s.charCodeAt(i); a ^= c; a = Math.imul(a, 16777619); b = (Math.imul(b, 33) ^ c) | 0; }
  return (a >>> 0).toString(36) + '.' + (b >>> 0).toString(36) + '.' + s.length.toString(36);
}
function dvCopia(x){ return x === undefined ? null : JSON.parse(JSON.stringify(x)); }
function dvQuincena(f){ f = String(f || ''); return 'm' + f.slice(0,7) + (parseInt(f.slice(8,10),10) > 15 ? 'b' : 'a'); }
function dvSinAportes(m){ var o = {}; Object.keys(m).forEach(function(k){ if(k !== 'aportes') o[k] = m[k]; }); return o; }
/* `vis` (hasta cuándo tengo lo de cada uno) es de cada dispositivo: lo mío lo
   marca cada uno al mandar, así que nunca coincide y los dos se lo pasarían para
   siempre. Viaja con la sincronización del viaje, no con esta. */
function dvViajeSin(v){ var o = {}; Object.keys(v).forEach(function(k){ if(k !== 'sync' && k !== 'arch' && k !== 'vis') o[k] = v[k]; }); return o; }
/* Todos los ítems de los datos: { clave: { v:valor, c:parte } }. */
function dvItems(){
  var out = {}, so = S.sy && S.sy.solo;
  function poner(k, v, c){
    if(so && (so[k] || (k.slice(0, 3) === 'ap:' && so['me:' + k.slice(3).split(':')[0]]))) return;
    out[k] = { v:v, c:c };
  }
  (S.tx||[]).forEach(function(t){ poner('tx:' + t.id, t, dvQuincena(t.fecha)); });
  (S.planes||[]).forEach(function(p){ poner('pl:' + p.id, p, 'b'); });
  (S.fijos||[]).forEach(function(f){ poner('fi:' + f.id, f, 'b'); });
  (S.pases||[]).forEach(function(p){ poner('pa:' + p.id, p, 'b'); });
  (S.hx||[]).forEach(function(x){ poner('hx:' + x.id, x, 'b'); });
  (S.metas||[]).forEach(function(m){
    poner('me:' + m.id, dvSinAportes(m), 'metas');
    (m.aportes||[]).forEach(function(a){ if(a && a.id) poner('ap:' + m.id + ':' + a.id, a, 'metas'); });
  });
  (S.viajes||[]).forEach(function(v){ poner('vj:' + v.id, dvViajeSin(v), 'v:' + v.id); });
  (S.vjHist||[]).forEach(function(h){ poner('vh:' + h.id, h, 'b'); });
  Object.keys(S.vjArch||{}).forEach(function(k){ poner('va:' + k, S.vjArch[k], 'a:' + k); });
  Object.keys(S).forEach(function(k){ if(DV_FUERA.indexOf(k) < 0 && S[k] !== undefined) poner('c:' + k, S[k], 'c'); });
  return out;
}
function dvParteDe(k, v){
  var p = k.slice(0, 3);
  if(p === 'tx:') return dvQuincena(v && v.fecha);
  if(p === 'me:' || p === 'ap:') return 'metas';
  if(p === 'vj:') return 'v:' + k.slice(3);
  if(p === 'va:') return 'a:' + k.slice(3);
  if(k.slice(0, 2) === 'c:') return 'c';
  return 'b';
}
/* ¿Esta parte de la configuración está como viene de fábrica? */
function dvDeFabrica(k, v){
  if(!dvBase) dvBase = emptyState();
  if(k === 'cuentas') return !Array.isArray(v) || v.every(function(c){ return !c.medio && !c.entidad && !c.manual && !(c.tna > 0); });
  if(k === 'tasa' || k === 'tasas' || k === 'dolar') return true;     // se bajan solas en cada dispositivo
  if(!(k in dvBase)) return false;
  return dvEstable(v) === dvEstable(dvBase[k]);
}
/* Anota qué ítems cambiaron desde la última vez. Devuelve si hubo algo. */
function dvMarcar(){
  var sy = S.sy; if(!sy || !sy.link) return false;
  famTraerRevisar();
  var h = sy.h || (sy.h = {}), it = dvItems(), ahora = Date.now(), cambio = false;
  var primera = !sy.marcado, base = primera ? (sy.base || ahora) : ahora;
  Object.keys(it).forEach(function(k){
    var hs = dvHash(it[k].v), r = h[k];
    if(r && r[0] === hs){ if(r[2] !== it[k].c){ r[2] = it[k].c; cambio = true; } return; }
    var t = (!r && primera && k.slice(0, 2) === 'c:' && dvDeFabrica(k.slice(2), it[k].v)) ? 1
          : (!r && primera) ? base : Math.max(ahora, r ? r[1] + 1 : 0);
    h[k] = [hs, t, it[k].c]; cambio = true;
  });
  Object.keys(h).forEach(function(k){
    if(it[k] || h[k][0] === null) return;
    h[k] = [null, Math.max(ahora, h[k][1] + 1), h[k][2]]; cambio = true;
  });
  // las marcas de borrado se olvidan al año y pico: para entonces ya viajaron
  Object.keys(h).forEach(function(k){ if(h[k][0] === null && ahora - h[k][1] > 400 * 864e5){ delete h[k]; cambio = true; } });
  sy.marcado = 1;
  return cambio;
}

function dvNombre(){
  if(AND()) return 'Celular (app)';
  var ua = navigator.userAgent || '';
  if(/Android|iPhone|iPad|Mobile/i.test(ua)) return 'Celular (navegador)';
  if(/Windows/i.test(ua)) return 'Compu (Windows)';
  if(/Macintosh|Mac OS/i.test(ua)) return 'Compu (Mac)';
  return 'Compu';
}

/* ---- la copia de antes de vincular ---- */
function dvRespaldar(){
  var txt = JSON.stringify(paraGuardar(sinSy())), ok = false;
  try{ localStorage.setItem(DV_ANTES, txt); ok = localStorage.getItem(DV_ANTES) === txt; }catch(e){}
  if(AND()){
    // en el teléfono queda además un archivo en Descargas
    try{ AND().exportar(txt, 'cuentas-claras-antes-de-vincular-' + today() + '.json'); ok = true; }catch(e){}
  } else if(!ok) exportar();          // si el navegador no la guarda, se descarga
  return ok;
}
function dvHayRespaldo(){ try{ return !!localStorage.getItem(DV_ANTES); }catch(e){ return false; } }

/* ---- desvincular y volver atrás ---- */
function dvDesvincular(){
  delete S.sy;
  ns.tags = {}; dvUI = null; dvConf = null; dvInv = null; dvRot = null; dvExtrano = false;
  save(); renderDisp(); nsRevisar();
  toast('Desvinculado. Tus datos quedan acá; los otros dispositivos siguen como estaban');
}
function dvRestaurar(){
  var txt = ''; try{ txt = localStorage.getItem(DV_ANTES) || ''; }catch(e){}
  if(!txt){ toast('No encontré la copia'); return; }
  try{
    var o = JSON.parse(txt);
    S = normalize(o); delete S.sy;
    dvConf = null; dvUI = null;
    save(); fillSelects(); render(); nsRevisar();
    toast('Volví a los datos de antes de vincular. Este dispositivo quedó desvinculado');
  }catch(e){ toast('La copia está dañada'); }
}

/* ---- las llaves ----
   Cada dispositivo vinculado tiene su propio par de llaves (ECDH P-256), que
   se crea al vincularlo y no sale nunca de él. La lista de los dispositivos de
   la familia (`S.sy.miembros`) guarda la llave pública de cada uno. Con eso:
   · al sumar uno nuevo, la clave de sincronización le llega cifrada sólo para
     él: quien fotografíe el código o lo intercepte no la puede leer;
   · al cambiar la clave, la nueva se le manda a cada dispositivo de la lista,
     cifrada para cada uno: el que tenía la clave vieja y no está en la lista
     (o lo sacaste), queda afuera. */
function dvAesDe(bytes){ return crypto.subtle.importKey('raw', bytes, { name:'AES-GCM' }, false, ['encrypt', 'decrypt']); }
function dvSellar(key, obj){
  var iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt({ name:'AES-GCM', iv:iv }, key, vjBytes(JSON.stringify(obj))).then(function(ct){
    var c = new Uint8Array(ct), t = new Uint8Array(12 + c.length); t.set(iv, 0); t.set(c, 12); return b64u(t);
  });
}
function dvAbrirSello(key, txt){
  var d = deB64u(txt);
  return crypto.subtle.decrypt({ name:'AES-GCM', iv:d.slice(0, 12) }, key, d.slice(12)).then(function(pt){ return JSON.parse(vjTexto(new Uint8Array(pt))); });
}
function dvLlavesNuevas(){
  return crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']).then(function(kp){
    return Promise.all([crypto.subtle.exportKey('raw', kp.publicKey), crypto.subtle.exportKey('pkcs8', kp.privateKey)]);
  }).then(function(r){ return { pub:b64u(new Uint8Array(r[0])), priv:b64u(new Uint8Array(r[1])) }; });
}
/* El secreto que comparten dos dispositivos: sale de mi llave privada y la
   pública del otro, y el otro llega al mismo con la suya y la mía. */
function dvSecreto(yo, otroPub){
  return Promise.all([
    crypto.subtle.importKey('pkcs8', deB64u(yo.priv), { name:'ECDH', namedCurve:'P-256' }, false, ['deriveBits']),
    crypto.subtle.importKey('raw', deB64u(otroPub), { name:'ECDH', namedCurve:'P-256' }, false, [])
  ]).then(function(k){ return crypto.subtle.deriveBits({ name:'ECDH', public:k[1] }, k[0], 256); })
  .then(function(bits){
    var a = new Uint8Array(bits), pre = vjBytes('cuentas-claras|ecdh|'), t = new Uint8Array(pre.length + a.length);
    t.set(pre, 0); t.set(a, pre.length);
    return crypto.subtle.digest('SHA-256', t);
  }).then(function(h){ return dvAesDe(new Uint8Array(h)); });
}
function dvLinkOk(d){ return !!(d && typeof d.id === 'string' && /^[A-Za-z0-9]{6,24}$/.test(d.id) && typeof d.k === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(d.k)); }
function dvMiembrosLimpios(o){
  var mi = {};
  if(o && typeof o === 'object') Object.keys(o).forEach(function(p){
    var m = o[p];
    if(/^[A-Za-z0-9_-]{40,120}$/.test(p) && m && typeof m === 'object'){
      mi[p] = { n:String(m.n || 'Dispositivo').slice(0,40), d:Number(m.d) || 0 };
      if(typeof m.p === 'string' && /^[A-Za-z0-9]{4,24}$/.test(m.p)) mi[p].p = m.p;     // de quién es, en un grupo familiar
    }
  });
  return mi;
}
function dvTagDe(pref, id, k){
  var key = pref + ':' + id;
  if(ns.tags[key]) return Promise.resolve(ns.tags[key]);
  return crypto.subtle.digest('SHA-256', vjBytes('cuentas-claras|' + pref + '|' + id + '|' + k)).then(function(h){
    return (ns.tags[key] = hexDe(new Uint8Array(h)).slice(0, 40));
  });
}
function dvTag(){ var L = dvLink(); return dvTagDe('dispositivos', L.id, L.k); }
function dvInvViva(){ return !!(dvInv && !dvInv.usado && Date.now() < dvInv.exp); }
function dvBuscando(){ return !!(dvBusca && dvBusca.estado === 'espera'); }
/* Lo que hay que escuchar además del canal de los datos: el código de un solo
   uso mientras dura, y los canales viejos un día después de cambiar la clave. */
function dvTagsExtra(){
  var l = [];
  if(dvInvViva()) l.push(dvTagDe('parear', dvInv.pid, dvInv.pk));
  if(dvBuscando()) l.push(dvTagDe('parear', dvBusca.pid, dvBusca.pk));
  if(dvQrViva()) l.push(Promise.resolve(dvQr.tag));
  ((S.sy && S.sy.viejos) || []).forEach(function(v){ if(v.hasta > Date.now()) l.push(dvTagDe('dispositivos', v.id, v.k)); });
  return l;
}
function dvQuiere(){ return dvActivo() || dvInvViva() || dvBuscando() || dvQrViva(); }
/* Un mensaje a los relays. Los importantes (la respuesta a un pedido, el cambio
   de clave) quedan guardados hasta que un relay confirma que lo tiene: si se
   corta internet o se cierra la app, se mandan la próxima vez. */
function dvEvento(llave, tag, d, content, clave, guardar){
  var ts = Math.max(Math.floor(Date.now() / 1000), (ns.ts[clave] || 0) + 1); ns.ts[clave] = ts;
  return nsFirmar({ id:llave }, { kind:NS_KIND, created_at:ts, tags:[['d', d], ['t', tag]], content:content }).then(function(ev){
    ns.ultimo[clave] = ev; ns.vistos[ev.id] = 1;
    if(guardar && S.sy){ S.sy.pendEv = S.sy.pendEv || {}; S.sy.pendEv[clave] = ev; writeLocal(); }
    NS_RELAYS.forEach(function(u){ var c = ns.con[u]; if(nsAbierta(c)) nsEnviar(c, ['EVENT', ev]); });
    return ev;
  });
}
function dvConfirmoEvento(id){
  var p = S.sy && S.sy.pendEv; if(!p) return;
  Object.keys(p).forEach(function(k){ if(p[k] && p[k].id === id){ delete p[k]; writeLocal(); } });
}
function dvPendEventos(){ var p = (S.sy && S.sy.pendEv) || {}; return Object.keys(p).map(function(k){ return p[k]; }).filter(Boolean); }

/* ---- el código de un solo uso ----
   Lo que muestra la pantalla (el código y el QR) NO es la clave de tus datos:
   es un pase que dura 10 minutos y sirve una sola vez. El dispositivo nuevo lo
   usa para pedir entrar; el que ya está te muestra el pedido con un número de
   verificación, y sólo si aceptás le manda la clave, cifrada para él. */
var DV_PAR_TTL = (window.CC_PAR_TTL > 0 ? window.CC_PAR_TTL : 10 * 60e3);
var dvInv = null, dvBusca = null, dvRot = null, dvAfuera = '', dvExtrano = false, dvRelojT = null;
/* Un ".f" al final: es una invitación al grupo familiar, no un dispositivo tuyo.
   ".fz" (v240): y el que entra arranca de cero, lo de antes no se suma. */
function dvCodigoPar(inv){ return 'CCP1.' + inv.pid + '.' + inv.pk + (inv.fam ? (inv.cero ? '.fz' : '.f') : ''); }
function dvCodigoDe(txt){
  var m = String(txt || '').match(/CCP1\.([A-Za-z0-9]{8,24})\.([A-Za-z0-9_-]{16,64})(\.f(z)?)?/);
  return m ? { pid:m[1], pk:m[2], fam:!!m[3], cero:!!m[4] } : null;
}
/* Seis números que salen del código y de la llave del que pide: los dos
   dispositivos los muestran, y si no coinciden es que el pedido es de otro. */
function dvVerif(pid, pub){
  return crypto.subtle.digest('SHA-256', vjBytes('cuentas-claras|verif|' + pid + '|' + pub)).then(function(h){
    var b = new Uint8Array(h), n = ((b[0] << 16) | (b[1] << 8) | b[2]) % 1000000, s2 = String(n);
    while(s2.length < 6) s2 = '0' + s2;
    return s2.slice(0,3) + ' ' + s2.slice(3);
  });
}
function dvReloj(){
  if(dvRelojT) return;
  dvRelojT = setInterval(function(){
    var cambio = false;
    if(dvInv && !dvInv.usado && Date.now() >= dvInv.exp){ dvInv = null; cambio = true; }
    if(dvBusca && dvBusca.estado === 'espera' && Date.now() - dvBusca.desde >= DV_PAR_TTL){ dvBusca.estado = 'vencido'; cambio = true; }
    if(dvQr && dvQr.estado !== 'vencido' && dvQr.estado !== 'listo' && Date.now() >= dvQr.exp){ dvQr.estado = 'vencido'; cambio = true; }
    var sq = document.getElementById('dvQrVence');
    if(sq && dvQr) sq.textContent = dvQrVenceTxt();
    if(cambio) nsRevisar();
    var span = document.getElementById('dvVence');
    if(span && dvInv) span.textContent = dvVenceTxt();
    if(cambio) renderDisp();
    if(!dvInv && !dvBuscando() && !dvQrViva()){ clearInterval(dvRelojT); dvRelojT = null; }
  }, 5000);
}
function dvQrVenceTxt(){
  var m = Math.max(0, Math.ceil((dvQr.exp - Date.now()) / 60000));
  return m <= 1 ? 'Vence en menos de un minuto' : 'Vence en ' + m + ' minutos';
}
function dvVenceTxt(){
  var m = Math.max(0, Math.ceil((dvInv.exp - Date.now()) / 60000));
  return m <= 1 ? 'Vence en menos de un minuto' : 'Vence en ' + m + ' minutos';
}
/* El vínculo nuevo de este dispositivo, con su par de llaves. */
function dvCrearVinculo(yo0){
  dvRespaldar();
  var base = Number(S.updatedAt) || Date.now(), k = b64u(crypto.getRandomValues(new Uint8Array(16)));
  return (yo0 ? Promise.resolve(yo0) : dvLlavesNuevas()).then(function(yo){
    S.sy = { link:{ id:vjIdCorto(), k:k, desde:Date.now() }, yo:yo, miembros:{}, h:{}, pub:{}, vistos:{}, viejos:[], repTs:0, marcado:0, base:base };
    S.sy.miembros[yo.pub] = { n:dvNombre(), d:Date.now() };
    dvAfuera = '';
    save();
  });
}
/* "Vincular otro dispositivo" / "Sumar otro dispositivo": un código nuevo. */
function dvInvitar(){
  if(!nsHay()){ toast('Este navegador es muy viejo para sincronizar'); return; }
  (dvActivo() ? Promise.resolve() : dvCrearVinculo()).then(function(){
    dvInv = { pid:vjIdCorto(), pk:b64u(crypto.getRandomValues(new Uint8Array(16))), exp:Date.now() + DV_PAR_TTL, req:null, usado:false,
              per:miPersona() ? { id:miPersona() } : null };
    dvRot = null; dvConf = null;
    renderDisp(); nsRevisar(); dvReloj();
  }).catch(function(){ toast('No pude crear el código'); });
}
/* Invitar a otra persona al grupo familiar: el mismo código de un solo uso,
   pero el que entra queda como una persona nueva, con el nombre que le pusiste. */
function dvInvitarPersona(nombre, cero){
  if(!nsHay() || !dvActivo() || !miPersona()) return;
  dvInv = { pid:vjIdCorto(), pk:b64u(crypto.getRandomValues(new Uint8Array(16))), exp:Date.now() + DV_PAR_TTL, req:null, usado:false,
            fam:true, cero:!!cero, per:{ id:vjIdCorto(), n:nombre } };
  dvRot = null; dvConf = null;
  renderDisp(); nsRevisar(); dvReloj();
}
function dvParRecibir(ev){
  var p = ev.content.split('.'); if(p.length !== 3) return;
  var ctx = (dvInv && p[1] === dvInv.pid) ? dvInv : ((dvBusca && p[1] === dvBusca.pid) ? dvBusca : null);
  if(!ctx) return;
  dvAesDe(deB64u(ctx.pk)).then(function(key){ return dvAbrirSello(key, p[2]); }).then(function(o){
    if(ctx === dvInv) dvInvRecibe(o); else if(ctx === dvBusca) dvBuscaRecibe(o);
  }).catch(function(){});
}
/* Del lado del que ya está: llegó un pedido. Se toma el primero y se pregunta. */
function dvInvRecibe(o){
  var inv = dvInv;
  if(!inv || inv.usado || inv.req || Date.now() >= inv.exp || !o || o.t !== 'q' || typeof o.pub !== 'string' || !/^[A-Za-z0-9_-]{40,120}$/.test(o.pub)) return;
  if(S.sy && S.sy.miembros && S.sy.miembros[o.pub]) return;
  inv.req = { pub:o.pub, n:String(o.n || 'Otro dispositivo').slice(0,40), verif:'', cz:!!o.cz };
  dvVerif(inv.pid, o.pub).then(function(v){
    inv.req.verif = v;
    go(inv.fam ? 'familia' : 'ajustes'); renderDisp();
    setTimeout(function(){ irA(inv.fam ? '#fmPedido' : '#cardDisp'); }, 80);
    toast(inv.req.n + ' pide sumarse');
  });
}
function dvResponder(inv, obj, clave, guardar){
  return Promise.all([dvAesDe(deB64u(inv.pk)), dvTagDe('parear', inv.pid, inv.pk)]).then(function(x){
    return dvSellar(x[0], obj).then(function(env){
      return dvEvento('par:' + inv.pid + ':a', x[1], 'cc3:' + x[1] + ':r', 'CCQ1.' + inv.pid + '.' + env, clave, guardar);
    });
  });
}
function dvAceptar(){
  var inv = dvInv; if(!inv || !inv.req || !inv.req.verif || inv.usado || !dvActivo()) return;
  var r = inv.req, sy = S.sy, L = sy.link;
  inv.usado = true;
  sy.miembros[r.pub] = { n:r.n, d:Date.now() };
  if(inv.per && inv.per.id) sy.miembros[r.pub].p = inv.per.id;
  if(inv.fam && inv.per && !personaPorId(inv.per.id)){
    S.personas = perJuntar(S.personas || [], [{ id:inv.per.id, n:inv.per.n, c:Date.now(), t:Date.now() }]);
  }
  if(inv.fam && inv.cero && inv.per){ S.famCero = Object.assign({}, S.famCero || {}); S.famCero[inv.per.id] = 'cero'; }
  save();
  dvSecreto(sy.yo, r.pub).then(function(key){
    return dvSellar(key, { id:L.id, k:L.k, miembros:sy.miembros, ts:Math.max(Date.now(), (sy.repTs || 0) + 1), pers:S.personas || [],
                           cero:!!(inv.fam && inv.cero) });
  }).then(function(ct){
    return dvResponder(inv, { t:'r', pub:sy.yo.pub, ct:ct }, 'par:' + inv.pid + ':r', true);
  }).then(function(){
    // los demás dispositivos se enteran de que hay uno más en la familia
    if(Object.keys(sy.miembros).length > 2) dvRepartir(L, sy.miembros, L, []);
    dvInv = null; renderDisp(); nsRevisar();
    toast(inv.fam ? ('Listo: ' + inv.per.n + ' ya está en el grupo') : ('Listo: ' + r.n + ' quedó vinculado'));
  }).catch(function(){ toast('No pude mandarle la clave'); });
}
function dvRechazar(){
  var inv = dvInv; if(!inv) return;
  inv.usado = true;
  dvResponder(inv, { t:'no' }, 'par:' + inv.pid + ':r', false).catch(function(){});
  dvInv = null; renderDisp(); nsRevisar();
  toast('Rechazado. Ese código ya no sirve');
}
/* Del lado del que pide: llegó un código (pegado, por el link o por el QR). */
function dvPedir(txt){
  var c = dvCodigoDe(txt);
  if(!c){ toast('Ese código no es de Cuentas Claras, o está incompleto'); return; }
  dvPend = c; dvUI = null; dvBusca = null;
  go(c.fam ? 'familia' : 'ajustes'); renderDisp();
  setTimeout(function(){ irA(c.fam ? '#familiaCuerpo' : '#cardDisp'); }, 80);
}
function dvConfirmar(){
  var c = dvPend; if(!c) return;
  if(!nsHay()){ toast('Este navegador es muy viejo para sincronizar'); return; }
  dvPend = null;
  dvRespaldar();
  dvLlavesNuevas().then(function(yo){
    dvBusca = { pid:c.pid, pk:c.pk, yo:yo, estado:'espera', desde:Date.now(), verif:'', fam:!!c.fam, cero:!!(c.fam && c.cero) };
    return Promise.all([dvVerif(c.pid, yo.pub), dvAesDe(deB64u(c.pk)), dvTagDe('parear', c.pid, c.pk)]);
  }).then(function(x){
    var b = dvBusca; if(!b) return;
    b.verif = x[0];
    renderDisp(); nsRevisar(); dvReloj();
    return dvSellar(x[1], { t:'q', pub:b.yo.pub, n:dvNombre(), ts:Date.now(), cz:1 }).then(function(env){
      return dvEvento('par:' + b.pid + ':b', x[2], 'cc3:' + x[2] + ':q:' + b.yo.pub.slice(0, 10), 'CCQ1.' + b.pid + '.' + env, 'par:' + b.pid + ':q', false);
    });
  }).catch(function(){ toast('No pude mandar el pedido'); });
}
function dvBuscaRecibe(o){
  var b = dvBusca; if(!b || b.estado !== 'espera' || !o) return;
  if(o.t === 'no'){ b.estado = 'no'; renderDisp(); nsRevisar(); return; }
  if(o.t !== 'r' || typeof o.pub !== 'string' || typeof o.ct !== 'string') return;
  dvSecreto(b.yo, o.pub).then(function(key){ return dvAbrirSello(key, o.ct); }).then(function(d){
    if(dvBusca !== b || b.estado !== 'espera') return;
    var mi = dvMiembrosLimpios(d && d.miembros);
    if(!dvLinkOk(d) || !mi[b.yo.pub] || !mi[o.pub]) return;
    var base = Number(S.updatedAt) || Date.now();
    S.sy = { link:{ id:d.id, k:d.k, desde:Date.now() }, yo:b.yo, miembros:mi, h:{}, pub:{}, vistos:{}, viejos:[], repTs:Number(d.ts) || 0, marcado:0, base:base };
    // el grupo familiar: quiénes son, y lo que ya tenías cargado pasa a tener tu nombre
    if(Array.isArray(d.pers)) S.personas = perJuntar(S.personas || [], personasLimpias(d.pers));
    // tus categorías y medios no se pierden cuando llegan los del grupo: se suman
    dvUnion = { medios:(S.medios || []).slice(), catGasto:(S.catGasto || []).slice(), catIng:(S.catIng || []).slice(),
                grupoDe:Object.assign({}, S.grupoDe || {}), hasta:Date.now() + 15 * 60e3 };
    if(miPersona()) etiquetar();
    // v240: si el grupo te recibe "de cero", lo que ya tenías queda sólo en este dispositivo
    var cero = !!(b.fam && miPersona() && (d.cero || b.cero));
    if(cero){ var so = dvSoloAhora(); if(so) S.sy.solo = so; }
    dvBusca = null; dvAfuera = '';
    save(); renderDisp(); nsRevisar();
    toast(b.fam && miPersona() ? ('Listo, ' + nombrePersona(miPersona()) + ': ya estás en el grupo. '
                                  + (cero ? 'Lo que tenías de antes lo seguís viendo vos, y al grupo va lo que cargues desde hoy' : 'Lo que cargues le aparece a los demás con tu nombre'))
                               : 'Vinculado. Tus datos se están juntando con los del otro dispositivo');
  }).catch(function(){});
}

/* ============================================================
   v265: pasar los datos con un QR, como en WhatsApp
   ============================================================
   Un dispositivo muestra un QR (y un código de 12 letras, por si no se puede
   escanear) y el otro lo escanea. El que muestra elige para dónde van los datos:
   · "traer": este dispositivo recibe los del otro (lo que tenga se reemplaza,
     con una copia antes);
   · "dar": los datos de este pasan al otro.
   Después los dos quedan vinculados, con el mismo canal cifrado de siempre.
   El código no es la clave: de él salen una etiqueta para encontrarse en los
   relays y una llave para cerrar los mensajes del encuentro. La clave del
   vínculo viaja cifrada con ECDH para la llave del que recibe (como en v166).
   Mensajes (`CCW1.` + sellado con la llave del código):
   · h: el que muestra se presenta {dir, pub, n}
   · q: el que va a recibir pide {pub, n}           (cuando el que muestra da)
   · r: el que da manda el vínculo {pub, ct}         (ct cifrado con ECDH)
   12 letras de 32 = 60 bits: en los 10 minutos que dura no se adivina. */
var DV_QR_ABC = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
var dvQr = null;
function dvQrCodigoNuevo(){
  var b = crypto.getRandomValues(new Uint8Array(12)), c = '';
  for(var i = 0; i < 12; i++) c += DV_QR_ABC[b[i] & 31];
  return c;
}
function dvQrLimpio(txt){
  var t = String(txt || '').toUpperCase();
  var m = t.match(/CCW1\.([2-9A-Z]{12})(?![2-9A-Z])/);
  if(m) t = m[1];
  t = t.replace(/[^0-9A-Z]/g, '');
  if(t.length !== 12) return '';
  for(var i = 0; i < 12; i++) if(DV_QR_ABC.indexOf(t[i]) < 0) return '';
  return t;
}
function dvQrLindo(c){ return c.slice(0, 4) + ' ' + c.slice(4, 8) + ' ' + c.slice(8); }
function dvQrPreparar(q){
  return Promise.all([
    crypto.subtle.digest('SHA-256', vjBytes('cuentas-claras|qr-llave|' + q.code)).then(function(h){ return dvAesDe(new Uint8Array(h)); }),
    dvTagDe('qr', q.code, 'w')
  ]).then(function(x){ q.K = x[0]; q.tag = x[1]; return q; });
}
function dvQrViva(){ return !!(dvQr && dvQr.tag && Date.now() < dvQr.exp && dvQr.estado !== 'listo'); }
function dvTieneDatos(){
  return ((S.tx || []).length + (S.planes || []).length + (S.metas || []).length + (S.fijos || []).length + (S.viajes || []).length) > 0;
}
function dvQrMandar(obj, suf, guardar){
  var q = dvQr; if(!q || !q.K) return Promise.reject(new Error('sin qr'));
  return dvSellar(q.K, obj).then(function(env){
    return dvEvento('qr:' + q.tag.slice(0, 16) + ':' + suf, q.tag, 'cc3:' + q.tag + ':' + suf, 'CCW1.' + env, 'qr:' + q.tag + ':' + suf, guardar && !!S.sy);
  });
}
/* Mostrar el QR. dir = 'traer' (los datos vienen a este) o 'dar' (salen de este). */
/* v266: "vinculado" de verdad es tener al menos otro dispositivo en la lista.
   Uno que sólo se tiene a sí mismo (por ejemplo, porque mostró un QR de la v265
   y canceló) se trata como sin vincular. */
function dvConOtros(){ return dvActivo() && dvOtros().length > 0; }
function dvQrMostrar(dir){
  if(!nsHay()){ toast('Este navegador es muy viejo para sincronizar'); return; }
  var q = { rol:'muestra', dir:dir, code:dvQrCodigoNuevo(), exp:Date.now() + DV_PAR_TTL, estado:'espera', reemplaza:false };
  // v266: mostrar el QR no vincula nada: el vínculo se arma recién cuando el otro entra
  var paso = (dir === 'dar' && dvActivo())
    ? Promise.resolve().then(function(){ q.yo = S.sy.yo; })
    : dvLlavesNuevas().then(function(yo){ q.yo = yo; if(dir === 'traer') q.reemplaza = dvTieneDatos(); });
  dvUI = null; dvPend = null; dvBusca = null; dvRot = null;
  paso.then(function(){ return dvQrPreparar(q); }).then(function(){
    var falta = 330 - (Date.now() - dvSlT);
    return falta > 0 ? new Promise(function(r){ setTimeout(r, falta); }) : null;
  }).then(function(){
    if(dvQr && dvQr.rol === 'escanea') return Promise.reject(new Error('otro'));
    if(dvDir !== dir) return Promise.reject(new Error('otro'));   // eligió el otro mientras tanto
    dvQr = q;
    renderDisp(); nsRevisar(); dvReloj();
    // v268: se acomoda la pantalla desde el deslizador, así se sigue viendo lo que elegiste
    setTimeout(function(){ irA(document.querySelector('#dispCuerpo .dv-slider, #dispCuerpo .dv-pasar') ? '#dispCuerpo .dv-slider, #dispCuerpo .dv-pasar' : '#dvQrCaja'); }, 60);
    return dvQrMandar({ t:'h', dir:dir, pub:q.yo.pub, n:dvNombre() }, 'h', false);
  }).catch(function(e){ if(!e || e.message !== 'otro') toast('No pude armar el QR'); });
}
/* Del lado del que escanea (o escribe el código). */
function dvQrUsar(txt){
  var code = dvQrLimpio(txt);
  if(!code){ toast('Ese código no está completo: son 12 letras y números'); return false; }
  if(!nsHay()){ toast('Este navegador es muy viejo para sincronizar'); return false; }
  if(dvQr && dvQr.code === code) return true;
  var q = { rol:'escanea', code:code, exp:Date.now() + DV_PAR_TTL, estado:'busca', desde:Date.now() };
  dvUI = null; dvPend = null; dvBusca = null; dvRot = null;
  dvQrPreparar(q).then(function(){
    dvQr = q;
    go('ajustes'); renderDisp(); nsRevisar(); dvReloj();
    setTimeout(function(){ irA('#cardDisp'); }, 80);
  });
  return true;
}
function dvQrRecibir(ev){
  var q = dvQr; if(!q || !q.K || q.estado === 'listo') return;
  dvAbrirSello(q.K, ev.content.slice(5)).then(function(o){
    if(dvQr !== q || !o || typeof o.pub !== 'string' || !/^[A-Za-z0-9_-]{40,120}$/.test(o.pub)) return;
    if(q.rol === 'escanea'){
      if(o.t === 'h' && q.estado === 'busca' && (o.dir === 'traer' || o.dir === 'dar')){
        q.otro = { pub:o.pub, n:String(o.n || 'Otro dispositivo').slice(0, 40), dir:o.dir };
        q.estado = 'confirmar'; q.reemplaza = o.dir === 'dar' && dvTieneDatos();
        renderDisp(); setTimeout(function(){ irA('#dvQrCaja'); }, 60);
      } else if(o.t === 'r' && q.estado === 'espera' && q.otro && o.pub === q.otro.pub && typeof o.ct === 'string'){
        dvQrEntrar(q, o);
      }
    } else {
      if(o.t === 'q' && q.dir === 'dar' && q.estado === 'espera' && o.pub !== q.yo.pub){
        q.estado = 'mandando';
        dvQrDar(q, o.pub, String(o.n || 'Otro dispositivo').slice(0, 40));
      } else if(o.t === 'r' && q.dir === 'traer' && q.estado === 'espera' && typeof o.ct === 'string'){
        dvQrEntrar(q, o);
      }
    }
  }).catch(function(){});
}
/* El que da: suma al otro a la lista y le manda el vínculo cifrado para él. */
function dvQrDar(q, otroPub, otroN){
  (dvActivo() ? Promise.resolve() : dvCrearVinculo(q.yo)).then(function(){ dvQrDar2(q, otroPub, otroN); })
    .catch(function(){ q.estado = q.rol === 'muestra' ? 'espera' : 'confirmar'; renderDisp(); toast('No pude armar el vínculo'); });
}
function dvQrDar2(q, otroPub, otroN){
  var sy = S.sy, L = sy && sy.link; if(!L) return;
  if(!(sy.miembros[otroPub])){
    sy.miembros[otroPub] = { n:otroN, d:Date.now() };
    if(miPersona()) sy.miembros[otroPub].p = miPersona();
  }
  save();
  dvSecreto(sy.yo, otroPub).then(function(key){
    return dvSellar(key, { id:L.id, k:L.k, miembros:sy.miembros, ts:Math.max(Date.now(), (sy.repTs || 0) + 1), pers:S.personas || [] });
  }).then(function(ct){
    return dvQrMandar({ t:'r', pub:sy.yo.pub, ct:ct }, 'r', true);
  }).then(function(){
    if(Object.keys(sy.miembros).length > 2) dvRepartir(L, sy.miembros, L, []);
    q.estado = 'listo'; dvQr = null;
    renderDisp(); nsRevisar();
    toast('Listo: tus datos están pasando a ' + otroN + '. Quedaron vinculados');
  }).catch(function(){ q.estado = 'espera'; toast('No pude mandarle los datos'); });
}
/* El que escanea confirma. */
function dvQrConfirmar(){
  var q = dvQr; if(!q || q.rol !== 'escanea' || q.estado !== 'confirmar' || !q.otro) return;
  if(q.otro.dir === 'traer'){
    if(!dvTieneDatos()) return;          // v269: nada que pasar (ver dvQrHtml)
    // el otro quiere recibir: le paso lo mío
    q.estado = 'mandando'; renderDisp();
    dvQrDar(q, q.otro.pub, q.otro.n);
    return;
  }
  // el otro da: pido sus datos (lo de acá se reemplaza, con copia antes)
  dvRespaldar();
  q.estado = 'espera'; renderDisp();
  dvLlavesNuevas().then(function(yo){
    q.yo = yo;
    return dvQrMandar({ t:'q', pub:yo.pub, n:dvNombre() }, 'q:' + yo.pub.slice(0, 10), false);
  }).catch(function(){ q.estado = 'confirmar'; renderDisp(); toast('No pude mandar el pedido'); });
}
/* El que recibe: llegó el vínculo. */
function dvQrEntrar(q, o){
  dvSecreto(q.yo, o.pub).then(function(key){ return dvAbrirSello(key, o.ct); }).then(function(d){
    if(dvQr !== q || q.estado === 'listo') return;
    var mi = dvMiembrosLimpios(d && d.miembros);
    if(!dvLinkOk(d) || !mi[q.yo.pub] || !mi[o.pub]) return;
    // lo que hay acá se reemplaza por lo del otro (la copia ya quedó guardada)
    var reemplaza = dvTieneDatos();
    if(q.rol === 'muestra' && reemplaza) dvRespaldar();
    if(reemplaza) S = emptyState();
    else delete S.sy;
    S.sy = { link:{ id:d.id, k:d.k, desde:Date.now() }, yo:q.yo, miembros:mi, h:{}, pub:{}, vistos:{}, viejos:[], repTs:Number(d.ts) || 0,
             marcado:0, base:reemplaza ? 1 : (Number(S.updatedAt) || Date.now()) };
    if(Array.isArray(d.pers)) S.personas = perJuntar(S.personas || [], personasLimpias(d.pers));
    if(!reemplaza) dvUnion = { medios:(S.medios || []).slice(), catGasto:(S.catGasto || []).slice(), catIng:(S.catIng || []).slice(),
                              grupoDe:Object.assign({}, S.grupoDe || {}), hasta:Date.now() + 15 * 60e3 };
    if(miPersona()) etiquetar();
    q.estado = 'listo'; dvQr = null; dvAfuera = '';
    save(); fillSelects(); render(); renderDisp(); nsRevisar();
    toast('Vinculado con ' + ((q.otro && q.otro.n) || 'el otro dispositivo') + '. Tus datos están llegando');
  }).catch(function(){});
}
function dvQrCancelar(){ dvQr = null; renderDisp(); nsRevisar(); }

/* ---- la cámara ----
   BarcodeDetector donde está (Chrome en Android); si no, jsQR sobre un canvas. */
var qrEsc = null;
function qrEscanear(){
  var box = document.getElementById('qrScan'), vid = document.getElementById('qrVideo');
  if(!box || !vid) return;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ qrSinCamara(); return; }
  var esc0 = qrEsc = { vivo:true, stream:null, det:null, cv:null, ult:'', avisoT:0, foco:document.activeElement };
  box.hidden = false;
  document.getElementById('qrScanNota').textContent = 'Apuntá la cámara al QR que muestra la otra pantalla.';
  try{ if('BarcodeDetector' in window) esc0.det = new window.BarcodeDetector({ formats:['qr_code'] }); }catch(e){ esc0.det = null; }
  navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } }, audio:false }).then(function(st){
    if(qrEsc !== esc0 || !esc0.vivo){ st.getTracks().forEach(function(t){ t.stop(); }); return; }
    esc0.stream = st; vid.srcObject = st;
    var pl = vid.play(); if(pl && pl.catch) pl.catch(function(){});
    setTimeout(qrMirar, 300);
  }).catch(function(){ qrCerrar(); qrSinCamara(); });
  try{ box.querySelector('[data-dv="qrcerrar"]').focus({ preventScroll:true }); }catch(e){}
}
function qrMirar(){
  var e = qrEsc; if(!e || !e.vivo) return;
  var vid = document.getElementById('qrVideo');
  var seguir = function(){ if(qrEsc === e && e.vivo) e.timer = setTimeout(qrMirar, 180); };
  if(!vid || vid.readyState < 2 || !vid.videoWidth){ seguir(); return; }
  if(e.det){
    e.det.detect(vid).then(function(l){ if(l && l[0] && l[0].rawValue) qrLeido(l[0].rawValue); seguir(); })
      .catch(function(){ e.det = null; seguir(); });
    return;
  }
  if(typeof window.jsQR !== 'function'){ qrCerrar(); qrSinCamara(); return; }
  var w = vid.videoWidth, h = vid.videoHeight, k = Math.min(1, 640 / Math.max(w, h));
  var cw = Math.round(w * k), ch = Math.round(h * k);
  var cv = e.cv || (e.cv = document.createElement('canvas'));
  if(cv.width !== cw) cv.width = cw;
  if(cv.height !== ch) cv.height = ch;
  var cx = cv.getContext('2d', { willReadFrequently:true });
  try{
    cx.drawImage(vid, 0, 0, cw, ch);
    var img = cx.getImageData(0, 0, cw, ch);
    var r = window.jsQR(img.data, cw, ch, { inversionAttempts:'dontInvert' });
    if(r && r.data) qrLeido(r.data);
  }catch(x){}
  seguir();
}
function qrLeido(txt){
  var e = qrEsc; if(!e || !e.vivo) return;
  if(dvQrLimpio(txt)){ qrCerrar(); dvQrUsar(txt); return; }
  if(dvCodigoDe(txt)){ qrCerrar(); dvPedir(txt); return; }
  if(txt !== e.ult || Date.now() - e.avisoT > 4000){
    e.ult = txt; e.avisoT = Date.now();
    document.getElementById('qrScanNota').textContent = 'Ese QR no es de Cuentas Claras. Buscá el que aparece en Ajustes del otro dispositivo.';
  }
}
function qrCerrar(){
  var e = qrEsc; qrEsc = null;
  var box = document.getElementById('qrScan'), vid = document.getElementById('qrVideo');
  if(e){ e.vivo = false; clearTimeout(e.timer); if(e.stream) e.stream.getTracks().forEach(function(t){ try{ t.stop(); }catch(x){} }); }
  if(vid){ try{ vid.pause(); }catch(x){} vid.srcObject = null; }
  if(box) box.hidden = true;
  if(e && e.foco && document.contains(e.foco)) try{ e.foco.focus({ preventScroll:true }); }catch(x){}
}
function qrSinCamara(){
  dvUI = 'pegar'; go('ajustes'); renderDisp();
  setTimeout(function(){ irA('#cardDisp'); var ti = document.getElementById('dvCodigoIn'); if(ti) try{ ti.focus(); }catch(x){} }, 80);
  toast('No pude usar la cámara. Escribí el código que aparece abajo del QR');
}
document.addEventListener('keydown', function(e){ if(qrEsc && (e.key === 'Escape' || e.key === 'Esc')){ e.preventDefault(); qrCerrar(); } }, true);

/* ---- repartir la clave ----
   A cada dispositivo de la lista le va la clave (la de siempre o una nueva) y
   la lista entera, cifradas para él. A los que se sacan les va un aviso, también
   cifrado para cada uno: así nadie con la clave vieja puede fingir que te
   sacaron. Viaja por el canal de ahora, que es el que todos están escuchando. */
function dvRepartir(canal, miembros, nuevo, fuera){
  var sy = S.sy, yo = sy.yo, ts = Math.max(Date.now(), (sy.repTs || 0) + 1), para = {};
  sy.repTs = ts;
  var dests = Object.keys(miembros).filter(function(p){ return p !== yo.pub; });
  var todos = dests.map(function(p){ return [p, { id:nuevo.id, k:nuevo.k, miembros:miembros, ts:ts }]; })
    .concat((fuera || []).map(function(p){ return [p, { fuera:1, ts:ts }]; }));
  return Promise.all(todos.map(function(x){
    return dvSecreto(yo, x[0]).then(function(key){ return dvSellar(key, x[1]); }).then(function(ct){ para[x[0]] = ct; }).catch(function(){});
  })).then(function(){ return dvTagDe('dispositivos', canal.id, canal.k); }).then(function(tag){
    var cuerpo = b64u(vjBytes(JSON.stringify({ de:yo.pub, ts:ts, para:para })));
    return dvEvento('dv:' + canal.id, tag, 'cc2:' + tag + ':rep:' + yo.pub.slice(0, 12), 'CCR1.' + canal.id + '.' + cuerpo, 'rep:' + canal.id, true);
  });
}
/* "Cambiar la clave": una nueva, sólo para los dispositivos que sigan marcados. */
function dvCambiarClave(){
  var sy = S.sy; if(!sy || !dvRot) return;
  var viejo = sy.link, mi = {}, fuera = [];
  Object.keys(sy.miembros).forEach(function(p){
    if(p === sy.yo.pub || dvRot.sel[p]) mi[p] = sy.miembros[p]; else fuera.push(p);
  });
  var nuevo = { id:vjIdCorto(), k:b64u(crypto.getRandomValues(new Uint8Array(16))), desde:Date.now() };
  dvRot = null;
  dvRepartir(viejo, mi, nuevo, fuera).then(function(){
    sy.viejos = (sy.viejos || []).concat([{ id:viejo.id, k:viejo.k, hasta:Date.now() + 864e5 }]).slice(-4);
    sy.link = nuevo; sy.miembros = mi; sy.pub = {};
    Object.keys(sy.vistos || {}).forEach(function(p){ if(!mi[p]) delete sy.vistos[p]; });
    dvExtrano = false;
    save(); renderDisp(); nsRevisar();
    toast('Listo: clave nueva. ' + (fuera.length ? 'Quedaron afuera ' + fuera.length + (fuera.length === 1 ? ' dispositivo' : ' dispositivos') + ' y' : 'Quedó afuera') + ' cualquiera que tuviera la vieja');
  }).catch(function(){ toast('No pude cambiar la clave. Probá de nuevo con internet'); renderDisp(); });
}
function dvRepRecibir(ev){
  var sy = S.sy; if(!sy) return;
  var p = ev.content.split('.'); if(p.length !== 3) return;
  var canal = sy.link.id === p[1] ? sy.link : (sy.viejos || []).filter(function(v){ return v.id === p[1]; })[0];
  if(!canal) return;
  var o; try{ o = JSON.parse(vjTexto(deB64u(p[2]))); }catch(e){ return; }
  if(!o || typeof o.de !== 'string' || o.de === sy.yo.pub || !sy.miembros[o.de] || !o.para || typeof o.para !== 'object') return;
  var ts = Number(o.ts) || 0, mio = o.para[sy.yo.pub];
  if(!(ts > (sy.repTs || 0)) || typeof mio !== 'string') return;
  var quien = sy.miembros[o.de].n;
  dvSecreto(sy.yo, o.de).then(function(key){ return dvAbrirSello(key, mio); }).then(function(d){
    if(S.sy !== sy || !d || Number(d.ts) !== ts || !(ts > (sy.repTs || 0))) return;
    if(d.fuera){
      // te sacaron de la familia (desde otro dispositivo de la lista): tus datos quedan
      delete S.sy; ns.tags = {}; dvAfuera = quien; dvInv = null; dvRot = null;
      save(); renderDisp(); nsRevisar();
      toast('Este dispositivo quedó desvinculado desde ' + quien + '. Tus datos siguen acá');
      return;
    }
    var mi = dvMiembrosLimpios(d.miembros);
    if(!dvLinkOk(d) || !mi[sy.yo.pub]) return;
    sy.repTs = ts; sy.miembros = mi;
    if(d.id !== sy.link.id){
      sy.viejos = (sy.viejos || []).concat([{ id:sy.link.id, k:sy.link.k, hasta:Date.now() + 864e5 }]).slice(-4);
      sy.link = { id:d.id, k:d.k, desde:Date.now() }; sy.pub = {};
      toast(quien + ' cambió la clave: ya estás usando la nueva');
    }
    save(); renderDisp(); nsRevisar();
  }).catch(function(){});
}

/* ---- subir ---- */
function dvPartes(){
  var h = S.sy.h, it = dvItems(), out = {};
  Object.keys(h).forEach(function(k){
    var r = h[k], c = r[2] || 'b';
    (out[c] || (out[c] = {}))[k] = [r[1], r[0] === null ? null : (it[k] ? it[k].v : null)];
  });
  return out;
}
function dvHuellas(){
  var h = S.sy.h, por = {};
  Object.keys(h).sort().forEach(function(k){ var c = h[k][2] || 'b'; por[c] = (por[c] || '') + k + ':' + h[k][0] + ':' + h[k][1] + ','; });
  Object.keys(por).forEach(function(c){ por[c] = dvHash(por[c]); });
  return por;
}
function dvPendientes(){
  var L = dvLink(); if(!L) return [];
  var fp = dvHuellas(), pub = S.sy.pub || {};
  return Object.keys(fp).filter(function(c){ return !pub[c] || pub[c].fp !== fp[c]; });
}
function dvSubir(){
  var L = dvLink(); if(!L || !nsHay() || !nsListo()) return;
  if(dvMarcar()) writeLocal();
  var fp = dvHuellas(), pub = S.sy.pub || (S.sy.pub = {}), partes = null;
  Object.keys(fp).forEach(function(c){
    var p = pub[c];
    if(p && p.fp === fp[c] && Date.now() - p.at < NS_REFRESCO) return;
    var e = ns.espera['dv:' + c];
    if(e && e.fp === fp[c] && Date.now() - e.desde < 15000) return;
    if(!partes) partes = dvPartes();
    dvPublicar(L, c, fp[c], partes[c] || {});
  });
}
function dvCifrar(L, obj){
  var json = vjBytes(JSON.stringify(obj));
  var zip = vjHayZip() ? vjComprimir(json) : Promise.resolve(null);
  return zip.then(function(z){
    var datos = z || json, iv = crypto.getRandomValues(new Uint8Array(12));
    return vjClave({ clave:L.k }, 'encrypt').then(function(k){
      return crypto.subtle.encrypt({ name:'AES-GCM', iv:iv }, k, datos);
    }).then(function(ct){
      var ctb = new Uint8Array(ct), todo = new Uint8Array(12 + ctb.length);
      todo.set(iv, 0); todo.set(ctb, 12);
      return 'CCD1.' + L.id + '.' + (z ? 'z' : '') + 'e.' + b64u(todo);
    });
  });
}
function dvDescifrar(L, txt){
  var p = txt.split('.');
  if(p[0] !== 'CCD1' || p[1] !== L.id || p[2].indexOf('e') < 0) return Promise.reject(new Error('otro'));
  var datos = deB64u(p[3]);
  return vjClave({ clave:L.k }, 'decrypt').then(function(k){
    return crypto.subtle.decrypt({ name:'AES-GCM', iv:datos.slice(0,12) }, k, datos.slice(12));
  }).then(function(pt){
    var b = new Uint8Array(pt);
    return p[2].indexOf('z') > -1 ? vjDescomprimir(b) : b;
  }).then(function(b){ return JSON.parse(vjTexto(b)); });
}
function dvPublicar(L, c, fp, it){
  var clave = 'dv:' + c, e = ns.espera[clave] = { fp:fp, desde:Date.now(), id:'' }, tag = '';
  dvTag().then(function(t){ tag = t; return dvCifrar(L, { v:1, n:dvNombre(), yo:S.sy.yo.pub, ts:Date.now(), c:c, it:it }); })
  .then(function(cod){
    if(cod.length > DV_MAX){
      // un viaje archivado muy grande no entra: queda su resumen, que va en otra parte
      if(c.slice(0, 2) === 'a:'){ S.sy.pub[c] = { fp:fp, at:Date.now() }; writeLocal(); }
      throw new Error('grande');
    }
    var ts = Math.max(Math.floor(Date.now() / 1000), (ns.ts[clave] || 0) + 1);
    ns.ts[clave] = ts;
    return nsFirmar({ id:'dv:' + L.id }, { kind:NS_KIND, created_at:ts, tags:[['d', 'cc2:' + tag + ':' + c], ['t', tag]], content:cod });
  }).then(function(ev){
    e.id = ev.id; ns.pend[ev.id] = { dv:c, fp:fp }; ns.ultimo[clave] = ev; ns.vistos[ev.id] = 1;
    NS_RELAYS.forEach(function(u){ var cc = ns.con[u]; if(nsAbierta(cc)) nsEnviar(cc, ['EVENT', ev]); });
    dvPintarEstado();
  }).catch(function(x){
    // si no entra, se deja de intentar un rato (queda la espera) en vez de reintentar en cada guardado
    if(!(x && x.message === 'grande') && ns.espera[clave] === e) delete ns.espera[clave];
  });
}
function dvConfirmado(id, p){
  delete ns.pend[id];
  var clave = 'dv:' + p.dv;
  if(ns.espera[clave] && ns.espera[clave].id === id) delete ns.espera[clave];
  if(!S.sy) return;
  S.sy.pub = S.sy.pub || {};
  S.sy.pub[p.dv] = { fp:p.fp, at:Date.now() };
  writeLocal();
  dvPintarEstado();
}


/* ---- recibir ---- */
function dvRecibir(ev){
  var L = dvLink(); if(!L) return;
  dvDescifrar(L, ev.content).then(function(o){
    var sy = S.sy;
    if(!o || typeof o.it !== 'object' || !sy) return;
    var yoPub = sy.yo.pub, de = typeof o.yo === 'string' ? o.yo : '';
    if(de !== yoPub){
      if(de && sy.miembros[de]){
        var vis = sy.vistos || (sy.vistos = {}), ant = vis[de];
        if(!ant || (Number(o.ts) || 0) > ant.ts) vis[de] = { ts:Number(o.ts) || 0 };
      } else dvExtrano = true;       // tiene la clave pero no está en la lista
    }
    var r = dvJuntar(o.it);
    if(r.cambios){ if(de !== yoPub) dvLlegoDe = de && sy.miembros[de] ? sy.miembros[de].n : 'otro dispositivo'; dvDespues(); }
    else { writeLocal(); renderDisp(); }
  }).catch(function(){});
}
/* Se juntan varios paquetes seguidos (al conectarse llegan todos juntos) y se
   guarda y redibuja una sola vez. */
/* Al entrar a un vínculo o a un grupo, las listas de este dispositivo (medios,
   categorías) se suman a las que llegan, en vez de quedar pisadas: durante un
   rato después de vincular, lo que falte se vuelve a agregar. */
var dvUnion = null;
function dvSumarListas(){
  if(!dvUnion) return;
  if(Date.now() > dvUnion.hasta){ dvUnion = null; return; }
  function sumar(lista, extra){
    extra.forEach(function(x){
      if(lista.some(function(y){ return y.toLowerCase() === x.toLowerCase(); })) return;
      var i = lista.indexOf('Otros'); if(i > -1) lista.splice(i, 0, x); else lista.push(x);
    });
  }
  sumar(S.medios, dvUnion.medios); sumar(S.catGasto, dvUnion.catGasto); sumar(S.catIng, dvUnion.catIng);
  S.catGasto.forEach(function(c){ if(!S.grupoDe[c] || !esGrupo(S.grupoDe[c])) S.grupoDe[c] = esGrupo(dvUnion.grupoDe[c]) ? dvUnion.grupoDe[c] : (esGrupo('otros') ? 'otros' : S.grupos[0].id); });
}
/* v282: un medio de pago con el que alguien cargó algo (por ejemplo, otra persona
   del grupo que te cargó un gasto) siempre está en tu lista, así ves su saldo. */
function mediosUsados(s){
  if(!s || !Array.isArray(s.medios)) return false;
  var n = 0;
  function ver(m){
    if(typeof m !== 'string' || !(m = m.trim()) || s.medios.indexOf(m) > -1) return;
    s.medios.push(m); n++;
    if(Array.isArray(s.mediosQuitados)){ var k = s.mediosQuitados.indexOf(m); if(k > -1) s.mediosQuitados.splice(k, 1); }
  }
  (s.tx || []).forEach(function(t){ ver(t.medio); });
  (s.planes || []).forEach(function(p){ ver(p.medio); });
  (s.fijos || []).forEach(function(f){ ver(f.medio); });
  return n > 0;
}
function dvDespues(){
  clearTimeout(dvTimer);
  dvTimer = setTimeout(function(){
    dvSumarListas();
    mediosUsados(S);
    save(); fillSelects(); aplicarOrden();
    if(dvOcupado()) dvRepintar = true; else { render(); if(vista === 'viaje' || vjEnCarga()) vjRefrescar(); }
    renderDisp();
    if(dvLlegoDe){ toast('Se actualizó con lo de ' + dvLlegoDe); dvLlegoDe = ''; }
  }, 350);
}
/* No se redibuja mientras escribís en algo que se redibuja (una meta, un tope). */
function dvOcupado(){
  var a = document.activeElement;
  return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest
    && a.closest('#metaList, #presuEdit, #cuentaList, #catList, #medioList, #fijoList, #viajeCuerpo, #cargaViaje'));
}
document.addEventListener('focusout', function(){
  if(!dvRepintar) return;
  setTimeout(function(){ if(dvRepintar && !dvOcupado()){ dvRepintar = false; render(); } }, 250);
});
function dvOrden(k){ var p = k.slice(0, 3); return p.slice(0, 2) === 'c:' ? 0 : p === 'me:' ? 1 : p === 'ap:' ? 2 : 3; }
function dvEnLista(lista, id){ for(var i = 0; i < lista.length; i++) if(lista[i] && lista[i].id === id) return i; return -1; }
/* El valor que tiene hoy este dispositivo para un ítem (o undefined). */
function dvLocal(k){
  var p = k.slice(0, 3), id = k.slice(3), i, m;
  if(k.slice(0, 2) === 'c:'){ var ck = k.slice(2); return (DV_FUERA.indexOf(ck) < 0 && S[ck] !== undefined) ? S[ck] : undefined; }
  if(p === 'tx:'){ i = dvEnLista(S.tx, id); return i > -1 ? S.tx[i] : undefined; }
  if(p === 'pl:'){ i = dvEnLista(S.planes, id); return i > -1 ? S.planes[i] : undefined; }
  if(p === 'fi:'){ i = dvEnLista(S.fijos || [], id); return i > -1 ? S.fijos[i] : undefined; }
  if(p === 'pa:'){ i = dvEnLista(S.pases || [], id); return i > -1 ? S.pases[i] : undefined; }
  if(p === 'hx:'){ i = dvEnLista(S.hx || [], id); return i > -1 ? S.hx[i] : undefined; }
  if(p === 'vh:'){ i = dvEnLista(S.vjHist || [], id); return i > -1 ? S.vjHist[i] : undefined; }
  if(p === 'va:') return (S.vjArch || {})[id];
  if(p === 'me:'){ i = dvEnLista(S.metas, id); return i > -1 ? dvSinAportes(S.metas[i]) : undefined; }
  if(p === 'ap:'){
    var q = id.split(':'); i = dvEnLista(S.metas, q[0]); if(i < 0) return undefined;
    m = S.metas[i]; var j = dvEnLista(m.aportes || [], q[1]); return j > -1 ? m.aportes[j] : undefined;
  }
  if(p === 'vj:'){ i = dvEnLista(S.viajes || [], id); return i > -1 ? dvViajeSin(S.viajes[i]) : undefined; }
  return undefined;
}
function dvPoner(k, val){
  var p = k.slice(0, 3), id = k.slice(3), i, v = dvCopia(val);
  function en(lista){ var j = dvEnLista(lista, id); if(j > -1) lista[j] = v; else lista.push(v); return true; }
  if(k.slice(0, 2) === 'c:'){
    var ck = k.slice(2);
    if(!dvBase) dvBase = emptyState();
    if(DV_FUERA.indexOf(ck) > -1 || !(ck in dvBase) || v === null) return false;
    S[ck] = v; return true;
  }
  if(!v || typeof v !== 'object'){ if(p === 'va:' && typeof v === 'string'){ S.vjArch = S.vjArch || {}; S.vjArch[id] = v; return true; } return false; }
  if(p === 'tx:') return en(S.tx);
  if(p === 'pl:') return en(S.planes);
  if(p === 'fi:') return en(S.fijos || (S.fijos = []));
  if(p === 'pa:') return en(S.pases || (S.pases = []));
  if(p === 'hx:') return en(S.hx || (S.hx = []));
  if(p === 'vh:') return en(S.vjHist || (S.vjHist = []));
  if(p === 'me:'){
    i = dvEnLista(S.metas, id);
    if(i > -1){ var ap = S.metas[i].aportes || []; v.aportes = ap; S.metas[i] = v; }
    else { v.aportes = []; S.metas.push(v); }
    return true;
  }
  if(p === 'ap:'){
    var q = id.split(':'); i = dvEnLista(S.metas, q[0]); if(i < 0) return false;
    var m = S.metas[i]; m.aportes = m.aportes || [];
    var j = dvEnLista(m.aportes, q[1]); if(j > -1) m.aportes[j] = v; else m.aportes.push(v);
    return true;
  }
  if(p === 'vj:'){
    var nv = vjLimpio(v); if(!nv) return false;
    S.viajes = S.viajes || []; i = dvEnLista(S.viajes, id);
    if(i > -1){ nv.sync = S.viajes[i].sync; nv.vis = S.viajes[i].vis; S.viajes[i] = nv; } else S.viajes.push(nv);
    return true;
  }
  return false;
}
function dvQuitar(k){
  var p = k.slice(0, 3), id = k.slice(3), antes;
  function fuera(lista){ var n = lista.length; var l = lista.filter(function(x){ return !(x && x.id === id); }); return { l:l, hubo:l.length !== n }; }
  var r;
  if(p === 'tx:'){ r = fuera(S.tx); S.tx = r.l; return r.hubo; }
  if(p === 'pl:'){ r = fuera(S.planes); S.planes = r.l; return r.hubo; }
  if(p === 'fi:'){ r = fuera(S.fijos || []); S.fijos = r.l; return r.hubo; }
  if(p === 'pa:'){ r = fuera(S.pases || []); S.pases = r.l; return r.hubo; }
  if(p === 'hx:'){ r = fuera(S.hx || []); S.hx = r.l; return r.hubo; }
  if(p === 'vh:'){ r = fuera(S.vjHist || []); S.vjHist = r.l; return r.hubo; }
  if(p === 'me:'){ r = fuera(S.metas); S.metas = r.l; return r.hubo; }
  if(p === 'vj:'){ r = fuera(S.viajes || []); S.viajes = r.l; if(r.hubo && viajeSel === id){ viajeSel = null; vjReset(); } return r.hubo; }
  if(p === 'va:'){ antes = !!(S.vjArch && S.vjArch[id]); if(antes) delete S.vjArch[id]; return antes; }
  if(p === 'ap:'){
    var q = id.split(':'), i = dvEnLista(S.metas, q[0]); if(i < 0) return false;
    var m = S.metas[i], n = (m.aportes || []).length;
    m.aportes = (m.aportes || []).filter(function(a){ return a.id !== q[1]; });
    return m.aportes.length !== n;
  }
  return false;
}
/* Junta los ítems que llegaron. De cada uno queda el más nuevo. */
function dvJuntar(it){
  var h = S.sy.h || (S.sy.h = {}), cambios = 0, borrar = [];
  var claves = Object.keys(it).filter(function(k){ return Array.isArray(it[k]) && Number(it[k][0]) > 0; })
    .sort(function(a, b){ return dvOrden(a) - dvOrden(b); });
  // antes de un borrado grande, una copia (por si algo salió mal en el otro lado)
  claves.forEach(function(k){ var r = it[k], mio = h[k]; if(r[1] === null && Number(r[0]) > (mio ? mio[1] : 0) && dvLocal(k) !== undefined) borrar.push(k); });
  if(borrar.length > 10){ try{ localStorage.setItem(DV_RESP, JSON.stringify(paraGuardar(sinSy()))); }catch(e){} }
  claves.forEach(function(k){
    var t = Number(it[k][0]), val = it[k][1], mio = h[k], lt = mio ? mio[1] : 0;
    // las personas del grupo no se pisan: se juntan las de los dos lados
    if(k === 'c:personas' && Array.isArray(val)){
      var pa = dvHash(S.personas || []), pm = perJuntar(S.personas || [], personasLimpias(val)), pd = dvHash(pm), pv = dvHash(val);
      if(pd !== pa){ S.personas = pm; cambios++; }
      h[k] = [pd, pd === pv ? Math.max(t, lt) : Math.max(Date.now(), t + 1, lt + 1), 'c'];
      return;
    }
    // un viaje no se pisa: se juntan los gastos y la gente de los dos lados
    if(k.slice(0, 3) === 'vj:' && val && typeof val === 'object'){
      var i = dvEnLista(S.viajes || [], k.slice(3));
      if(i > -1){
        var v = S.viajes[i], hr = dvHash(val), antes = dvHash(dvViajeSin(v));
        if(mio && mio[0] === null && t <= lt) return;          // lo borré después
        if(antes === hr) { if(t > lt) h[k] = [hr, t, 'v:' + v.id]; return; }
        vjJuntar(v, { m:val.miembros, x:val.gastos, vis:val.vis, c:val.cierre, mo:val.mons });
        if(t > lt){
          if(val.nombre) v.nombre = String(val.nombre).slice(0,40);
          if(val.cargado) v.cargado = val.cargado;
        }
        if(!v.clave && val.clave) v.clave = String(val.clave).slice(0,64);
        if(!v.yo && val.yo) v.yo = String(val.yo).slice(0,24);
        var desp = dvHash(dvViajeSin(v));
        if(desp !== antes) cambios++;
        h[k] = [desp, desp === hr ? Math.max(t, lt) : Math.max(Date.now(), t + 1, lt + 1), 'v:' + v.id];
        return;
      }
    }
    if(t <= lt) return;
    if(val === null){
      if(dvQuitar(k)) cambios++;
      h[k] = [null, t, mio ? mio[2] : dvParteDe(k, null)];
      return;
    }
    if(!dvPoner(k, val)) return;
    var loc = dvLocal(k), hl = loc === undefined ? null : dvHash(loc), hr2 = dvHash(val);
    // si al guardarlo quedó distinto (se ordenó o completó algo), esta versión pasa a ser la nueva
    h[k] = [hl, hl === hr2 ? t : Math.max(Date.now(), t + 1), dvParteDe(k, loc)];
    cambios++;
  });
  return { cambios:cambios, borrados:borrar.length };
}

/* ---- estado y pantalla ---- */
function dvEstado(){
  if(!nsHay()) return ['off', 'Este navegador no puede sincronizar. Usá la app de Android o la página web en un navegador actual.'];
  var abiertas = 0, listas = 0, fallas = 0;
  NS_RELAYS.forEach(function(u){ var c = ns.con[u]; if(!c) return; if(c.fallas) fallas++; if(nsAbierta(c)){ abiertas++; if(c.eose) listas++; } });
  var pend = dvPendientes().length > 0 || dvPendEventos().length > 0;
  if(!abiertas){
    if(!fallas) return ['busca', 'Conectando…'];
    return ['off', pend ? 'Sin conexión. Lo que cargues se manda solo cuando vuelva internet.' : 'Sin conexión. Cuando vuelva internet, se sincroniza solo.'];
  }
  if(!listas) return ['busca', 'Buscando lo de tus otros dispositivos…'];
  if(pend) return ['busca', 'Mandando lo tuyo…'];
  return ['ok', 'Al día. Con internet, lo que cargues va y viene solo.'];
}
function dvPintarEstado(){
  if(!dvActivo()) return;
  var e = dvEstado();
  ['dvAuto', 'fmAuto'].forEach(function(id){
    var el = document.getElementById(id); if(!el) return;
    el.className = 'vj-auto ' + e[0];
    var s2 = el.querySelector('span'); if(s2 && s2.textContent !== e[1]) s2.textContent = e[1];
  });
}
function dvOtros(){
  var sy = S.sy; if(!sy) return [];
  return Object.keys(sy.miembros || {}).filter(function(p){ return p !== sy.yo.pub; })
    .map(function(p){ var m = sy.miembros[p], v = (sy.vistos || {})[p];
      return { pub:p, n:m.n + ((hayGrupo() && m.p) ? ' · ' + nombrePersona(m.p) : ''), d:m.d, ts:v ? v.ts : 0, p:m.p || '' }; })
    .sort(function(a, b){ return a.d - b.d; });
}
var DV_ICO_BAJA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M12 7v7M9 11l3 3 3-3"/></svg>';
var DV_ICO_SUBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M12 15V8M9 11l3-3 3 3"/></svg>';
var DV_ICO_CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M4 12h16"/></svg>';
/* v265: el pase por QR, en sus distintos momentos */
function dvQrHtml(){
  var q = dvQr; if(!q) return '';
  var cancelar = '<button class="btn ghost sm" type="button" data-dv="qrcancelar">Cancelar</button>';
  if(q.estado === 'vencido'){
    return '<div class="dv-caja" id="dvQrCaja"><p class="note">' + (q.rol === 'muestra'
        ? 'El QR venció: duran 10 minutos. Armá uno nuevo cuando estés con el otro dispositivo.'
        : 'No encontré el otro dispositivo. Fijate que el código esté bien, que los dos tengan internet y que el QR no haya vencido.') + '</p>'
      + '<div class="rowflex"><button class="btn ghost sm" type="button" data-dv="qrcancelar">Listo</button></div></div>';
  }
  if(q.rol === 'muestra'){
    var link = VJ_URL + '#cc=CCW1.' + q.code, qr = '';
    try{ qr = vjQrSvg(link); }catch(x){}
    var traer = q.dir === 'traer';
    return '<div class="dv-caja dv-qrcaja" id="dvQrCaja">'
      + '<p class="note" style="text-align:left">Escaneá este QR con la cámara del ' + (traer ? 'celu que tiene tus datos' : 'otro dispositivo') + ':</p>'
      + (qr ? '<div class="vj-qr">' + qr + '</div>' : '')
      + '<p class="note" style="margin:6px 0 2px">O allá, en Ajustes › Tus dispositivos y tus datos › <b>Tengo un código</b>, escribí:</p>'
      + '<p class="dv-codigo" id="dvQrCodigo">' + esc(dvQrLindo(q.code)) + '</p>'
      + '<p class="note"><b id="dvQrVence">' + esc(dvQrVenceTxt()) + '</b> y sirve una sola vez. No es tu clave.'
      + (traer ? (q.reemplaza ? ' Lo que hay acá se reemplaza por lo del otro; antes te guardo una copia.' : '') : ' Lo que haya en el otro se reemplaza por lo de acá.') + '</p>'
      + (traer && dvConOtros() ? '<p class="note warn">Este dispositivo ya está vinculado con ' + esc(dvOtros().map(function(o){ return o.n; }).join(' y ')) + ': al traer los datos de otro, deja ese vínculo.</p>' : '')
      + '<p class="dv-busca note" style="justify-content:center"><i aria-hidden="true"></i><span>' + (q.estado === 'mandando' ? 'Mandando tus datos…' : 'Esperando que lo escanees…') + '</span></p>'
      + '<div class="rowflex" style="justify-content:center">' + cancelar + '</div></div>';
  }
  // el que escaneó
  if(q.estado === 'busca'){
    return '<div class="dv-caja" id="dvQrCaja"><p class="dv-busca"><i aria-hidden="true"></i><b>Buscando el otro dispositivo…</b></p>'
      + '<p class="note">Código ' + esc(dvQrLindo(q.code)) + '. Los dos tienen que tener internet.</p>'
      + '<div class="rowflex">' + cancelar + '</div></div>';
  }
  var o = q.otro || { n:'el otro dispositivo', dir:'traer' };
  if(q.estado === 'confirmar'){
    if(o.dir === 'traer' && !dvTieneDatos()){
      return '<div class="dv-caja dv-preg" id="dvQrCaja"><p><b>Acá no hay datos para pasar.</b></p>'
        + '<p class="note">' + esc(o.n) + ' quiere traer tus datos, pero en ' + (AND() ? 'esta app' : 'este navegador') + ' no hay nada cargado. '
        + 'Si los tenés en la app de Android (la cámara del celu abre el navegador, no la app), abrí la app y tocá Ajustes › Tus dispositivos y tus datos › <b>Tengo un código</b>, y escribí el código que aparece abajo del QR.</p>'
        + '<div class="rowflex">' + cancelar + '</div></div>';
    }
    if(o.dir === 'traer'){
      return '<div class="dv-caja dv-preg" id="dvQrCaja"><p><b>¿Pasar tus datos a ' + esc(o.n) + '?</b></p>'
        + '<p class="note">Le llegan todos tus datos, cifrados, y quedan vinculados: lo que cargues en uno aparece en el otro. Acá no se borra nada.</p>'
        + '<div class="rowflex"><button class="btn" type="button" data-dv="qrok">Pasar mis datos</button>' + cancelar + '</div></div>';
    }
    return '<div class="dv-caja dv-preg" id="dvQrCaja"><p><b>¿Traer los datos de ' + esc(o.n) + ' a este dispositivo?</b></p>'
      + '<p class="note">' + (q.reemplaza ? 'Lo que hay acá se reemplaza por lo del otro; antes te guardo una copia, por si querés volver. ' : '')
      + 'Después quedan vinculados: lo que cargues en uno aparece en el otro.</p>'
      + (dvConOtros() ? '<p class="note warn">Este dispositivo ya está vinculado con otros: si seguís, deja ese vínculo.</p>' : '')
      + '<div class="rowflex"><button class="btn" type="button" data-dv="qrok">Traer los datos</button>' + cancelar + '</div></div>';
  }
  return '<div class="dv-caja" id="dvQrCaja"><p class="dv-busca"><i aria-hidden="true"></i><b>'
    + (o.dir === 'traer' ? 'Mandando tus datos a ' : 'Recibiendo los datos de ') + esc(o.n) + '…</b></p>'
    + '<div class="rowflex">' + cancelar + '</div></div>';
}
var dvDir = null, dvSlUlt = null, dvSlT = 0, dvDirAntes = null;
/* v275: de entrada, con datos marca "Pasar"; sin datos, "Traer" */
function dvDirVa(){ return dvDir || (dvTieneDatos() ? 'dar' : 'traer'); }
function dvSliderHtml(sel){
  function b(d, ico, t, sub){
    return '<button type="button" role="radio" aria-checked="' + (sel === d ? 'true' : 'false') + '" data-dv="qr' + d + '">' + ico + '<b>' + t + '</b><span>' + sub + '</span></button>';
  }
  return '<div class="dv-slider" role="radiogroup" aria-label="Para dónde van los datos" data-sel="' + (dvSlUlt || sel) + '" data-va="' + sel + '">'
    + '<i class="dv-sl-luz" aria-hidden="true"></i>'
    + b('traer', DV_ICO_BAJA, 'Traer mis datos acá', 'Desde el celu (u otro dispositivo) a este')
    + b('dar', DV_ICO_SUBE, 'Pasar estos datos a otro', 'De este dispositivo al celu (u otro)')
    + '</div>';
}
/* El deslizador se dibuja donde estaba y en el cuadro siguiente se corre: así se ve moverse. */
function dvSliderMover(el){
  var sl = el.querySelector('.dv-slider'); if(!sl) return;
  var va = sl.getAttribute('data-va'); dvSlUlt = va;
  if(sl.getAttribute('data-sel') !== va){ void sl.offsetWidth; requestAnimationFrame(function(){ sl.setAttribute('data-sel', va); }); }
}
/* v273: si este dispositivo ya tiene datos, lo normal es mandarlos: queda sólo
   "Pasar estos datos a otro", y traer los de otro (que reemplaza todo) pasa a
   un link discreto que además pide confirmar. Sin datos, el deslizador. */
function dvBotonDar(){
  return '<div class="dv-pasar" style="grid-template-columns:1fr"><button class="btn" type="button" data-dv="qrdar">' + DV_ICO_SUBE
    + '<b>Pasar estos datos a otro</b><span>Te muestro un QR para escanear con el otro dispositivo</span></button></div>';
}
function dvOpcionesHtml(){
  var html = dvSliderHtml(dvDirVa());
  if(dvUI === 'traerpre'){
    html += '<div class="dv-caja dv-preg" id="dvTraerPre" style="margin:0 0 12px"><p><b>¿Traer los datos de otro dispositivo a este?</b></p>'
      + '<p class="note">Todo lo que tenés acá (' + esc(dvResumenCorto()) + ') se reemplaza por lo del otro. Antes te guardo una copia, por si querés volver.</p>'
      + '<div class="rowflex"><button class="btn" type="button" data-dv="qrtraerok">Sí, traer los datos</button>'
      + '<button class="btn ghost sm" type="button" data-dv="traerno">Cancelar</button></div></div>';
  }
  return html;
}
function dvResumenCorto(){
  var n = (S.tx || []).length, p = (S.planes || []).length, m = (S.metas || []).length, l = [];
  if(n) l.push(n + (n === 1 ? ' movimiento' : ' movimientos'));
  if(p) l.push(p + (p === 1 ? ' compra en cuotas' : ' compras en cuotas'));
  if(m) l.push(m + (m === 1 ? ' meta' : ' metas'));
  return l.length ? l.join(', ') : 'tus datos';
}
/* Elegir para dónde van: el color se corre y, al terminar, aparece el QR abajo. */
function dvElegir(dir){
  if(dvQr && dvQr.rol === 'muestra' && dvQr.dir === dir && dvQr.estado !== 'vencido') return;
  if(dir === 'traer' && dvUI === 'traerpre') return;
  var antes = dvDirVa();
  dvDir = dir; dvSlT = Date.now();
  if(dvQr && dvQr.rol === 'muestra') dvQr = null;
  // v275: con datos, "traer" (que reemplaza todo) primero avisa y pide confirmar
  if(dir === 'traer' && dvTieneDatos()){ dvDirAntes = antes === 'traer' ? 'dar' : antes; dvUI = 'traerpre'; renderDisp(); return; }
  dvUI = null; renderDisp();
  dvQrMostrar(dir);
}
function dvCodigoCaja(){
  return '<div class="dv-caja" id="dvCodCaja"><label class="lab" for="dvCodigoIn">El código que aparece abajo del QR</label>'
    + '<input id="dvCodigoIn" class="dv-codin" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX XXXX XXXX" maxlength="80">'
    + '<div class="rowflex"><button class="btn" type="button" data-dv="usar">Seguir</button>'
    + '<button class="btn ghost sm" type="button" data-dv="cerrar">Cancelar</button></div></div>';
}
/* v269: sin "Escanear un QR": el QR se escanea con la cámara del teléfono, y si
   no, está el código. */
function dvBotonesQr(){
  return '<div class="dv-otra"><p class="note">¿El QR lo muestra el otro dispositivo? Escanealo con la cámara del celu, o escribí el código que tiene abajo.</p>'
    + '<button class="btn ghost" type="button" data-dv="pegar">Tengo un código</button></div>';
}
function renderDisp(){
  var el = document.getElementById('dispCuerpo'); if(!el) return;
  var L = dvLink(), html = '';
  if(vista === 'familia') renderFamilia();
  if(dvQr && dvQr.rol === 'muestra'){
    el.innerHTML = dvSliderHtml(dvQr.dir) + dvQrHtml();
    dvSliderMover(el); return;
  }
  if(dvQr){ el.innerHTML = dvQrHtml(); return; }
  // v266: vinculado sólo consigo mismo = como sin vincular (salvo que esté a mitad del código viejo)
  if(L && !dvOtros().length && !dvInvViva() && !dvRot) L = null;
  // del lado del que pide: confirmar, y después esperar a que lo acepten
  if(dvPend && !dvPend.fam){
    html += '<div class="dv-caja dv-preg"><p><b>¿Vincular este dispositivo?</b></p>'
      + '<p class="note">Los datos de acá se juntan con los del otro dispositivo: no se borra nada. Si algo cambió en los dos lados, queda lo último que tocaste. Antes te guardo una copia de lo que hay acá.</p>'
      + (L ? '<p class="note warn">Este dispositivo ya está vinculado: si seguís, deja ese vínculo y pasa a este.</p>' : '')
      + '<div class="rowflex"><button class="btn" type="button" data-dv="confirmar">Vincular</button>'
      + '<button class="btn ghost" type="button" data-dv="cancelar">Cancelar</button></div></div>';
    el.innerHTML = html; return;
  }
  if(dvBusca && !dvBusca.fam){
    var b = dvBusca;
    if(b.estado === 'espera'){
      html += '<div class="dv-caja dv-preg" id="dvEspera"><p><b>Ahora aceptalo en el otro dispositivo.</b></p>'
        + '<p class="note">Te va a mostrar un número. Tiene que ser este:</p>'
        + '<p class="dv-verif" id="dvVerif">' + esc(b.verif || '…') + '</p>'
        + '<p class="note">Si no coincide, rechazalo allá.</p>'
        + '<div class="rowflex"><button class="btn ghost sm" type="button" data-dv="soltar">Cancelar</button></div></div>';
    } else {
      html += '<div class="dv-caja"><p class="note">' + (b.estado === 'no'
          ? 'El otro dispositivo rechazó el pedido. No se vinculó nada.'
          : 'No hubo respuesta. El código dura 10 minutos y sirve una sola vez: pedí uno nuevo en el otro dispositivo.') + '</p>'
        + '<div class="rowflex"><button class="btn ghost sm" type="button" data-dv="soltar">Listo</button></div></div>';
    }
    el.innerHTML = html; return;
  }
  if(!L){
    if(dvAfuera) html += '<p class="note warn" style="margin:0 0 12px">Este dispositivo quedó desvinculado desde ' + esc(dvAfuera) + ', que cambió la clave sin incluirlo. Tus datos siguen acá.</p>';
    html += '<p class="note" style="margin:0 0 10px">Elegí para dónde van los datos y te muestro un QR. Todo viaja cifrado y no hace falta crear una cuenta.</p>'
      + dvOpcionesHtml()
      + dvBotonesQr();
    if(dvUI === 'pegar') html += dvCodigoCaja();
  } else {
    var e = dvEstado(), otros = dvOtros();
    var vistos = {};
    otros = otros.map(function(o){ var n = o.n || 'Dispositivo'; vistos[n] = (vistos[n] || 0) + 1; return Object.assign({}, o, {n: vistos[n] > 1 ? n + ' ' + vistos[n] : n}); });
    html += '<p class="vj-auto ' + e[0] + '" id="dvAuto" role="status"><i aria-hidden="true"></i><span>' + esc(e[1]) + '</span></p>';
    html += otros.length
      ? '<ul class="dv-lista">' + otros.map(function(o){
          return '<li><b>' + esc(o.n) + '</b><span>vinculado el ' + esc(fechaLabel(vjDiaDe(o.d || Date.now()))) + (o.ts ? ' · lo último, ' + esc(fechaHoraCorta(o.ts)) : '') + '</span></li>';
        }).join('') + '</ul>'
      : (dvInv && !dvInv.fam && dvInv.req && dvInv.req.verif) ? '' : '<p class="note" style="margin:0 0 12px">Todavía no sumaste otro dispositivo. Tocá "Pasar estos datos a otro" y escaneá el QR con el otro.</p>';
    if(dvInv && !dvInv.fam && dvInv.req && dvInv.req.verif){
      html += '<div class="dv-caja dv-preg" id="dvPedido" style="margin:0 0 12px"><p><b>' + esc(dvInv.req.n) + ' pide sumarse.</b></p>'
        + '<p class="note">Aceptá sólo si es tu dispositivo y si en su pantalla aparece este mismo número:</p>'
        + '<p class="dv-verif">' + esc(dvInv.req.verif) + '</p>'
        + '<div class="rowflex"><button class="btn" type="button" data-dv="aceptar">Aceptar</button>'
        + '<button class="btn ghost" type="button" data-dv="rechazar">Rechazar</button></div></div>';
    }
    if(dvExtrano) html += '<p class="note warn" style="margin:0 0 12px">Llegaron datos de un dispositivo que no está en tu lista. Si no fuiste vos, tocá "Cambiar la clave".</p>';
    html += dvOpcionesHtml()
      + dvBotonesQr()
      + (dvUI === 'pegar' ? dvCodigoCaja() : '')
      + '<div class="rowflex" style="gap:8px;margin-top:14px">'
      + '<button class="btn ghost" type="button" data-dv="rotar">Cambiar la clave</button>'
      + '<button class="btn ghost sm" type="button" data-dv="desvincular" style="color:var(--out);border-color:var(--out)">'
      + (dvConf === 'desvincular' ? 'Tocá otra vez para desvincular' : 'Desvincular este dispositivo') + '</button></div>';
    if(dvInvViva() && !dvInv.fam && !(dvInv.req && dvInv.req.verif)){
      var cod = dvCodigoPar(dvInv), link = VJ_URL + '#cc=' + cod, qr = '';
      try{ qr = vjQrSvg(link); }catch(x){}
      html += '<div class="dv-caja" id="dvInvita"><p class="note">En el otro dispositivo: Ajustes › Tus dispositivos › "Tengo un código", y pegá esto. Desde un celular también podés escanear el QR con la cámara.</p>'
        + '<textarea readonly rows="2" id="dvCodigoOut">' + esc(cod) + '</textarea>'
        + '<div class="rowflex"><button class="btn ghost sm" type="button" data-dv="copiar">Copiar el código</button>'
        + '<button class="btn ghost sm" type="button" data-dv="anular">Cancelar</button></div>'
        + (qr ? '<div class="vj-qr">' + qr + '</div>' : '')
        + '<p class="note" style="margin:10px 0 0"><b id="dvVence">' + esc(dvVenceTxt()) + '</b> y sirve una sola vez. No es tu clave: sólo sirve para pedir entrar, y el pedido lo tenés que aceptar acá.</p></div>';
    }
    if(dvRot){
      html += '<div class="dv-caja" id="dvRota"><p><b>Cambiar la clave</b></p>'
        + '<p class="note">Se crea una clave nueva y se la paso cifrada sólo a los dispositivos marcados. Los que desmarques, y cualquiera que tuviera la clave de antes, quedan afuera. Tus datos no cambian.</p>'
        + (otros.length ? '<div class="chips" role="group" aria-label="A quiénes se la paso">' + otros.map(function(o){
            return '<button type="button" data-dvsel="' + esc(o.pub) + '" aria-pressed="' + (dvRot.sel[o.pub] ? 'true' : 'false') + '">' + esc(o.n) + '</button>';
          }).join('') + '</div>' : '<p class="note">No hay otros dispositivos: la clave nueva queda sólo en este.</p>')
        + '<div class="rowflex"><button class="btn" type="button" data-dv="rotarok">Cambiar la clave</button>'
        + '<button class="btn ghost sm" type="button" data-dv="rotarno">Cancelar</button></div></div>';
    }
  }
  if(dvHayRespaldo()){
    html += '<p class="note" style="margin:14px 0 6px">Tenés guardada la copia de antes de vincular.</p>'
      + '<button class="btn ghost sm" type="button" data-dv="restaurar">'
      + (dvConf === 'restaurar' ? 'Tocá otra vez: vuelve todo a como estaba y se desvincula' : 'Volver a los datos de antes de vincular') + '</button>';
  }
  el.innerHTML = html;
  dvSliderMover(el);
}
document.addEventListener('keydown', function(e){
  if(e.key === 'Enter' && e.target && e.target.id === 'dvCodigoIn'){ e.preventDefault(); var b = document.querySelector('[data-dv="usar"]'); if(b) b.click(); }
});
document.addEventListener('click', function(e){
  var sel = e.target.closest ? e.target.closest('[data-dvsel]') : null;
  if(sel && dvRot){
    var pk = sel.getAttribute('data-dvsel');
    if(dvRot.sel[pk]) delete dvRot.sel[pk]; else dvRot.sel[pk] = true;
    sel.setAttribute('aria-pressed', dvRot.sel[pk] ? 'true' : 'false');
    return;
  }
  var b = e.target.closest ? e.target.closest('[data-dv]') : null;
  if(!b){ if(dvConf && !(e.target.closest && e.target.closest('#cardDisp'))){ dvConf = null; renderDisp(); } return; }
  var q = b.getAttribute('data-dv');
  if(q !== 'desvincular' && q !== 'restaurar') dvConf = null;
  if(q === 'crear'){ dvInvitar(); return; }      // el código largo de antes (ya no hay botón; lo usan las pruebas)
  if(q === 'qrtraer'){ dvElegir('traer'); return; }
  if(q === 'qrtraerok'){ dvUI = null; dvDir = 'traer'; dvSlT = 0; dvQrMostrar('traer'); return; }
  if(q === 'traerno'){ dvUI = null; dvDir = dvDirAntes || 'dar'; renderDisp(); return; }
  if(q === 'qrdar'){ dvElegir('dar'); return; }
  if(q === 'qrok'){ dvQrConfirmar(); return; }
  if(q === 'qrcancelar'){ dvQrCancelar(); return; }
  if(q === 'escanear'){ dvUI = null; qrEscanear(); return; }
  if(q === 'qrcerrar'){ qrCerrar(); return; }
  if(q === 'qrcodigo'){ qrCerrar(); dvUI = 'pegar'; renderDisp(); irA('#dvCodCaja'); var tq = document.getElementById('dvCodigoIn'); if(tq) try{ tq.focus(); }catch(x){} return; }
  if(q === 'anular'){ dvInv = null; renderDisp(); nsRevisar(); return; }
  if(q === 'aceptar'){ dvAceptar(); return; }
  if(q === 'rechazar'){ dvRechazar(); return; }
  if(q === 'pegar'){ dvUI = 'pegar'; renderDisp(); var ti = document.getElementById('dvCodigoIn'); if(ti) try{ ti.focus(); }catch(x){} return; }
  if(q === 'cerrar'){ dvUI = null; renderDisp(); return; }
  if(q === 'usar'){
    var tv = (document.getElementById('dvCodigoIn') || {}).value || '';
    if(dvCodigoDe(tv)) dvPedir(tv);       // un código largo de una versión vieja (CCP1…)
    else dvQrUsar(tv);
    return;
  }
  if(q === 'confirmar'){ dvConfirmar(); return; }
  if(q === 'cancelar'){ dvPend = null; renderDisp(); return; }
  if(q === 'soltar'){ dvBusca = null; renderDisp(); nsRevisar(); return; }
  if(q === 'rotar'){
    var s0 = {}; dvOtros().forEach(function(o){ s0[o.pub] = true; });
    dvRot = dvRot ? null : { sel:s0 }; dvInv = null; renderDisp(); nsRevisar(); return;
  }
  if(q === 'rotarno'){ dvRot = null; renderDisp(); return; }
  if(q === 'rotarok'){ dvCambiarClave(); return; }
  if(q === 'copiar'){
    var s2 = document.getElementById('dvCodigoOut'); if(!s2) return;
    var ok = function(){ toast('Código copiado. Vence en 10 minutos'); };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s2.value).then(ok, function(){ s2.select(); try{ document.execCommand('copy'); ok(); }catch(x){} });
    else { s2.select(); try{ document.execCommand('copy'); ok(); }catch(x){} }
    return;
  }
  if(q === 'desvincular'){ if(dvConf !== 'desvincular'){ dvConf = 'desvincular'; renderDisp(); return; } dvConf = null; dvDesvincular(); return; }
  if(q === 'restaurar'){ if(dvConf !== 'restaurar'){ dvConf = 'restaurar'; renderDisp(); return; } dvConf = null; dvRestaurar(); return; }
});
