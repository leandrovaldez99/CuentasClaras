/* Cuentas Claras · js/tasas-y-dolar.js
   Datos de afuera: tasas de bancos y billeteras, cotización del dólar y de otras monedas.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- actualizar la lista de tasas ----
   Fuente: api.argentinadatos.com, los mismos de la API del dólar. Vienen dos
   listas: los plazos fijos de los bancos (la TNA llega como fracción, 0.2 = 20%)
   y los rendimientos de las billeteras (que ya vienen en porcentaje).
   El emparejamiento es por el nombre con el que viene cada entidad, así los
   nombres cortos que ves en la app no se pierden cuando la lista se actualiza. */
var TASAS_URL_PF = 'https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo';
/* Las billeteras salen de comparatasas.ar, del grupo "Rendimiento variable" de
   ARS > Cuentas y Billeteras: son las cuentas cuya tasa surge de un fondo común
   de inversión. No publican una API, pero el archivo con el que arman la página
   sí se puede leer. Como es un archivo interno de ellos, lo leo con cuidado:
   busco el **nombre del fondo** de cada entidad (que es único, a diferencia del
   nombre de la billetera, que a veces aparece con dos productos distintos) y me
   quedo con el primer número decimal que aparece después, y sólo lo acepto si
   cae en un rango razonable. Si el día de mañana cambian el formato, no pasa
   nada: no entra ningún dato y quedan los que ya tenías. */
/* v290: comparatasas sacó su _payload.json (da 404 desde el 8/11/2026). Los mismos
   datos vienen ahora adentro de la página principal (__NUXT_DATA__). */
var TASAS_URL_CT = 'https://comparatasas.ar/';
/* v288: en el sitio de Netlify, comparatasas se pide por el mismo sitio
   (/tasas, una regla en _redirects): Netlify lo trae y el navegador no lo
   bloquea. En el artifact o abierto como archivo no hay regla: se usan los fondos. */
function tasasUrlCt(){
  try{ if(/^https?:$/.test(location.protocol) && /(^|\.)netlify\.app$/.test(location.hostname)) return location.origin + '/tasas'; }catch(e){}
  return TASAS_URL_CT;
}
/* v286: comparatasas no deja que una página web lea su archivo (no manda el
   permiso CORS), así que en el navegador las billeteras nunca se actualizaban:
   quedaban con las tasas de fábrica. La APK sí lo puede leer. Para la web, la
   tasa sale de los mismos fondos, pero desde argentinadatos (que sí deja): el
   valor de la cuotaparte del último día contra el del anterior, pasado a TNA. */
var FCI_BASE = 'https://api.argentinadatos.com/v1/finanzas/fci/';
var FCI_TIPOS = ['mercadoDinero', 'rentaFija'];
function tasasDeFci(pares){
  var por = {}, hoyMs = Date.parse(today());
  (pares || []).forEach(function(par){
    var u = par && par[0], p = par && par[1];
    if(!Array.isArray(u) || !Array.isArray(p)) return;
    var ant = {};
    p.forEach(function(x){ if(x && x.fondo) ant[x.fondo] = x; });
    u.forEach(function(x){
      if(!x || !x.fondo || por[x.fondo] !== undefined) return;
      var a = ant[x.fondo]; if(!a) return;
      var v1 = Number(x.vcp), v0 = Number(a.vcp), t1 = Date.parse(x.fecha), t0 = Date.parse(a.fecha);
      var d = (t1 - t0) / 864e5;
      if(!(v1 > 0 && v0 > 0) || !(d >= 1 && d <= 10)) return;
      if(hoyMs - t1 > 12 * 864e5) return;                 // dato viejo: no me lo creo
      por[x.fondo] = Math.round((v1 / v0 - 1) * 365 / d * 10000) / 100;
    });
  });
  var out = [];
  (S.tasas || []).forEach(function(e){
    var v = e.busca ? por[e.busca] : undefined;
    if(v >= 3 && v <= 90) out.push({ api:e.api, tna:v, tipo:'billetera' });
  });
  return out;
}

// la marca de los datos en la página de comparatasas (armada en dos partes para que
// esta misma página, si llegara por error, no la tenga escrita y se lea como datos)
var NUXT_MARCA = 'id="__NUXT' + '_DATA__"';
function tieneNuxt(t){ return typeof t === 'string' && t.indexOf(NUXT_MARCA) > -1; }
function tasasDeTexto(txt){
  var out = [];
  if(!txt || txt.length < 200) return out;
  // v288: si no es un JSON (una página de error), nada. v290: o la página de comparatasas con sus datos
  var esPagina = !/^\s*[\[{]/.test(txt);
  if(esPagina && !tieneNuxt(txt)) return out;
  (S.tasas||[]).forEach(function(e){
    if(!e.busca) return;
    // v290: en los datos el nombre va entre comillas y seguido de coma; así no se
    // confunde con el mismo nombre en un atributo de la página (alt="...")
    var i = txt.indexOf('"' + e.busca + '",');
    if(i === -1 && !esPagina) i = txt.indexOf('"' + e.busca);
    if(i === -1 && !esPagina) i = txt.indexOf(e.busca);
    if(i === -1) return;
    var desde = i + e.busca.length;
    var frag = txt.slice(desde, desde + 300);
    var m = frag.match(/(\d+\.\d+)/);          // sólo números con coma decimal
    if(!m) return;
    var v = Number(m[1]);
    if(v < 1.5) v = v * 100;                   // 0,2382 es 23,82%
    if(!(v >= 3 && v <= 90)) return;           // fuera de rango: no me lo creo
    out.push({ api:e.api, tna:Math.round(v * 100) / 100, tipo:'billetera' });
  });
  return out;
}

function nombreLindo(api){
  var t = String(api||'').toLowerCase()
    .replace(/\bs\.?a\.?u?\.?\b/g, ' ').replace(/\bsociedad anonima\b/g, ' ')
    .replace(/\bcompa[nñ]ia financiera\b/g, ' ').replace(/\bcooperativo limitado\b/g, ' ')
    .replace(/\bbanco de la\b|\bbanco del\b|\bbanco de\b|\bbanco\b/g, ' ')
    .replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  if(!t) t = String(api||'').toLowerCase();
  return t.replace(/(^|\s)([a-záéíóúñ])/g, function(m, a, b){ return a + b.toUpperCase(); }).slice(0, 40);
}
function mezclarTasas(lista){
  var porApi = {};
  (S.tasas||[]).forEach(function(x){ porApi[String(x.api||x.n).toLowerCase()] = x; });
  var nuevas = [];
  lista.forEach(function(x){
    if(!x.api || !(x.tna > 0)) return;
    var k = String(x.api).toLowerCase(), vieja = porApi[k];
    if(vieja){ if(!vieja.fija){ vieja.tna = x.tna; vieja.fuente = 'api'; vieja.tipo = x.tipo; vieja.al = today(); } }
    else nuevas.push({ n:nombreLindo(x.api), api:x.api, tna:x.tna, tipo:x.tipo, fuente:'api', al:today() });
  });
  S.tasas = (S.tasas||[]).concat(nuevas);
  S.tasas.sort(function(a,b){
    if(a.tipo !== b.tipo) return a.tipo === 'banco' ? -1 : 1;
    return a.tna - b.tna;
  });
  S.tasa = S.tasa || {};
  S.tasa.fecha = today();
  save(); render();
}
window.__tasasListo = function(pfTxt, ctTxt, fci){
  if(fci === undefined && tasasApk){ tasasApk(pfTxt, ctTxt); return; }
  window.__tasasJuntar(pfTxt, ctTxt, fci);
};
window.__tasasJuntar = function(pfTxt, ctTxt, fci){
  var lista = [];
  try{ lista = lista.concat(tasasDeTexto(ctTxt)); }catch(e){}
  // las billeteras que no vinieron de comparatasas, desde los fondos (v286)
  try{
    var ya = {}; lista.forEach(function(x){ ya[x.api] = 1; });
    tasasDeFci(fci).forEach(function(x){ if(!ya[x.api]) lista.push(x); });
  }catch(e){}
  try{
    var pf = JSON.parse(pfTxt);
    if(Array.isArray(pf)) pf.forEach(function(b){
      var v = Number(b && b.tnaClientes);
      if(b && b.entidad && v > 0) lista.push({ api:b.entidad, tna:v * 100, tipo:'banco', fuente:'api' });
    });
  }catch(e){}
  if(lista.length) mezclarTasas(lista);
};
function tasasTraer(u){ return fetch(u, {cache:'no-store'}).then(function(r){ return r.ok ? r.text() : ''; }).catch(function(){ return ''; }); }
function tasasJson(t){ try{ return t ? JSON.parse(t) : null; }catch(e){ return null; } }
function traerFci(){
  var urls = [];
  FCI_TIPOS.forEach(function(t){ urls.push(FCI_BASE + t + '/ultimo', FCI_BASE + t + '/penultimo'); });
  return Promise.all(urls.map(tasasTraer)).then(function(v){
    var fci = [];
    for(var i = 0; i < v.length; i += 2) fci.push([tasasJson(v[i]), tasasJson(v[i + 1])]);
    return fci;
  }).catch(function(){ return []; });
}
/* v287: en la APK, Android baja plazos fijos y comparatasas; los fondos los baja
   la página (argentinadatos sí deja). Se junta todo en una sola pasada; si Android
   no contesta en 25 segundos, van solos los fondos. */
var tasasApk = null;
function traerTasas(){
  if(AND()){
    var fciP = traerFci(), listo = false;
    tasasApk = function(pf, ct){
      if(listo) return; listo = true;
      fciP.then(function(fci){ window.__tasasJuntar(pf, ct, fci); });
    };
    try{ AND().pedirTasas(); }catch(e){}
    setTimeout(function(){ if(tasasApk) tasasApk('', ''); }, 25000);
    return;
  }
  try{
    var fciP2 = traerFci();
    Promise.all([tasasTraer(TASAS_URL_PF), tasasTraer(tasasUrlCt()), fciP2])
      .then(function(v){
        var hay = v[0] || v[1] || (v[2] || []).some(function(p){ return p[0] && p[1]; });
        if(hay) window.__tasasJuntar(v[0], v[1], v[2]);
        /* v289: comparatasas por Netlify a veces contesta un error de su lado. Lo
           de los fondos ya quedó puesto; a los 3 s se prueba otra vez y, si llega,
           se pisan las billeteras con lo de comparatasas. */
        if(!(v[1] && (/^\s*[\[{]/.test(v[1]) || tieneNuxt(v[1]))) && tasasUrlCt() !== TASAS_URL_CT){
          setTimeout(function(){
            tasasTraer(tasasUrlCt()).then(function(t){ if(t && (/^\s*[\[{]/.test(t) || tieneNuxt(t))) window.__tasasJuntar('', t, null); });
          }, 3000);
        }
      })
      .catch(function(){});
  }catch(e){}
}

/* Pone como cotización vigente la del tipo elegido. Es lo único que mira el
   resto de la app (`cotDolar()` lee `S.dolar.venta`), así que cambiar de tipo
   reacomoda solo todo lo que esté en dólares. */
function aplicarTipoDolar(auto){
  var t = S.dolar && S.dolar.tipos ? S.dolar.tipos[tipoDolar()] : null;
  if(!t || !(t.venta > 0)) return false;
  var cambia = (S.dolar.venta !== t.venta) || (S.dolar.fecha !== t.fecha) || (S.dolar.auto !== !!auto);
  S.dolar.venta = t.venta;
  S.dolar.fecha = t.fecha || today();
  S.dolar.auto = !!auto;
  return cambia;
}
/* Una sola llamada trae todos los dólares de una. Se guardan todos —así el
   desplegable muestra cuánto vale cada uno sin volver a salir a internet— y el
   elegido pasa a ser el vigente. Si mañana la API agrega o saca alguno, los que
   no conozco se ignoran y los que ya tenía quedan como estaban. */
window.__dolaresListo = function(txt){
  var lista = null;
  try{ lista = (typeof txt === 'string') ? JSON.parse(txt) : txt; }catch(e){ return; }
  if(!Array.isArray(lista) || !lista.length) return;
  S.dolar = S.dolar || {}; S.dolar.tipos = S.dolar.tipos || {};
  var cambio = false;
  lista.forEach(function(x){
    if(!x || typeof x !== 'object') return;
    var id = String(x.casa || '').toLowerCase();
    if(!esTipoDolar(id)) return;
    var v = Number(x.venta) || 0;
    if(!(v > 0) || v > 100000000) return;
    var f = (typeof x.fechaActualizacion === 'string' && x.fechaActualizacion.length >= 10)
      ? x.fechaActualizacion.slice(0,10) : today();
    var ant = S.dolar.tipos[id], co = Number(x.compra) || 0;
    if(!(co > 0) || co > 100000000) co = 0;
    if(!ant || ant.venta !== v || ant.fecha !== f || (ant.compra || 0) !== co) cambio = true;
    S.dolar.tipos[id] = { venta:v, fecha:f };
    if(co) S.dolar.tipos[id].compra = co;     // el conversor la usa para pasar dólares a pesos
  });
  if(!cambio) return;
  aplicarTipoDolar(true);
  save(); render();
};
/* Las otras monedas: la lista de /v1/cotizaciones (trae también el dólar
   oficial, que ya viene por el otro lado y acá se ignora). */
window.__monedasListo = function(txt){
  var lista = null;
  try{ lista = (typeof txt === 'string') ? JSON.parse(txt) : txt; }catch(e){ return; }
  if(!Array.isArray(lista) || !lista.length) return;
  S.dolar = S.dolar || {}; S.dolar.otras = S.dolar.otras || {};
  var cambio = false;
  lista.forEach(function(x){
    if(!x || typeof x !== 'object') return;
    var m = monedaDef(String(x.moneda || '').toUpperCase()); if(!m) return;
    var v = Number(x.venta) || 0; if(!(v > 0) || v > 100000000) return;
    var co = Number(x.compra) || 0; if(!(co > 0) || co > 100000000) co = 0;
    var f = (typeof x.fechaActualizacion === 'string' && x.fechaActualizacion.length >= 10) ? x.fechaActualizacion.slice(0,10) : today();
    var ant = S.dolar.otras[m.id];
    if(!ant || ant.venta !== v || ant.fecha !== f || (ant.compra || 0) !== co || ant.mano) cambio = true;
    S.dolar.otras[m.id] = { venta:v, fecha:f };
    if(co) S.dolar.otras[m.id].compra = co;
  });
  if(!cambio) return;
  save(); render();
};
/* La app de Android vieja llama acá con una sola cotización: es el tipo que
   tengas elegido. Se mantiene para no romper un APK sin actualizar. */
window.__dolarListo = function(venta, fecha){
  var v = Number(venta) || 0;
  if(v <= 0) return;
  S.dolar = S.dolar || {}; S.dolar.tipos = S.dolar.tipos || {};
  var f = (typeof fecha === 'string' && fecha.length >= 10) ? fecha.slice(0,10) : today();
  var id = tipoDolar(), ant = S.dolar.tipos[id];
  if(ant && ant.venta === v && ant.fecha === f && S.dolar.auto) return;
  S.dolar.tipos[id] = { venta:v, fecha:f };
  aplicarTipoDolar(true);
  save(); render();
};

/* Trae las cotizaciones al abrir. Si la llamada falla (sin internet, o un
   navegador que no deja salir a otros sitios) no pasa nada: quedan las últimas
   que traje, o la que cargaste a mano. */
var DOLAR_URL = 'https://dolarapi.com/v1/dolares', MONEDAS_URL = 'https://dolarapi.com/v1/cotizaciones';
function traerJson(url, listo){
  try{
    fetch(url, {cache:'no-store'})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if(d) listo(d); })
      .catch(function(){});
  }catch(e){}
}
function traerDolar(){
  if(AND()){
    // En Android la pide la app, no el WebView: así no depende de CORS.
    try{ if(AND().pedirDolares) AND().pedirDolares(); else AND().pedirDolar(); }catch(e){}
    // una APK anterior a la 1.2.1 no sabe pedir las otras monedas: pruebo desde acá
    try{ if(AND().pedirMonedas) AND().pedirMonedas(); else traerJson(MONEDAS_URL, window.__monedasListo); }catch(e){}
    return;
  }
  traerJson(DOLAR_URL, window.__dolaresListo);
  traerJson(MONEDAS_URL, window.__monedasListo);
}
