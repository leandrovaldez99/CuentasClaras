/* Cuentas Claras · js/persistencia.js
   Guardar y leer los datos: almacenamiento, validación de lo que se lee (normalize) y arranque de los datos.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   persistencia
   ============================================================ */
var LS = 'plata-clara-v1';
var DATA_PATH = 'data/finanzas.json';
var cloud = null, cloudReady = false, modo = 'local';
var saveTimer = null, saving = false, pending = false;

/* Puente con la app de Android (APK). Adentro de un navegador `AndroidStore`
   no existe y todo esto queda inerte: sigue mandando a localStorage. */
function AND(){ return (typeof window.AndroidStore !== 'undefined') ? window.AndroidStore : null; }

function readLocal(){
  var a = AND();
  if(a){
    try{
      var txt = a.leer();
      if(txt) return JSON.parse(txt);
    }catch(e){}
    return null;
  }
  try{ var raw = localStorage.getItem(LS); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}
/* ---- el espacio donde se guardan los datos ----
   En la versión web los datos viven en el almacenamiento del navegador, que
   tiene tope: unos 5 MB según el navegador (Safari puede ser menos). Si se
   llena, `setItem` falla y antes eso pasaba en silencio: la app seguía
   funcionando, pero lo que cargabas se perdía al cerrarla. Ahora se avisa. En
   el APK (un archivo del teléfono) y en Claude (un archivo en la nube) no hay
   ese tope, así que ahí no se muestra nada. */
var TOPE_NAV = 5000000, CASI_NAV = 0.7;
var espacio = { chars:0, fallo:false, oculto:false };
/* Los datos sin el vínculo de sincronización (`sy`): así salen las copias
   exportadas, los respaldos y la copia en la nube. La clave de sincronización y
   la llave de este dispositivo no viajan en ningún archivo. */
function sinSy(){ var o = {}; Object.keys(S).forEach(function(k){ if(k !== 'sy') o[k] = S[k]; }); return o; }
/* ---- v292: los medios de pago tienen id ----
   En lo que se guarda (el navegador, el archivo del teléfono, la copia que
   exportás) cada medio es { id, nombre, dia } y todo lo que lo usa (movimientos,
   cuotas, fijos, pases, cuentas que rinden, lo que se pagaron en el grupo, la
   parte de un viaje) guarda su id. Dos medios pueden tener cualquier nombre sin
   que se mezclen, y cambiarle el nombre a uno no toca nada más que el medio.
   Mientras la app está abierta trabaja con el nombre: al abrir, cada id se cambia
   por su nombre (como un JOIN) y al guardar se vuelve a escribir el id. Así los
   celulares del grupo que todavía tienen una versión anterior se siguen
   entendiendo con éste (entre ellos se mandan los nombres, como siempre).
   El id de cada nombre vive en S._medId, que no se guarda ni se sincroniza tal
   cual: viaja adentro de la lista de medios. */
function medReg(o){
  o = o || S;
  if(!o._medId) Object.defineProperty(o, '_medId', { value:{}, writable:true, configurable:true, enumerable:false });
  return o._medId;
}
function paraGuardar(src){
  var reg = medReg(S), lista = Array.isArray(src.medios) ? src.medios : [];
  // sólo los medios de la lista llevan id; un nombre suelto que no está (datos viejos) queda como nombre
  var id = function(n){
    if(typeof n !== 'string' || !n || lista.indexOf(n) < 0) return n;
    if(!reg[n]) reg[n] = 'md' + uid();
    return reg[n];
  };
  var sal = function(x){
    var y = {}; Object.keys(x).forEach(function(k){ y[k] = x[k]; });
    if(typeof y.medio === 'string') y.medio = id(y.medio);
    if(y.sal && typeof y.sal === 'object'){
      var r = {}; Object.keys(y.sal).forEach(function(k){ var v = y.sal[k]; r[k] = (v && typeof v === 'object') ? { t:v.t, de:id(v.de), a:id(v.a) } : v; });
      y.sal = r;
    }
    return y;
  };
  var o = {}; Object.keys(src).forEach(function(k){ o[k] = src[k]; });
  var dia = (src.diaMedio && typeof src.diaMedio === 'object') ? src.diaMedio : {};
  o.medios = lista.map(function(n){ var m = { id:id(n), nombre:n }; if(dia[n] >= 1) m.dia = dia[n]; return m; });
  var resto = {}, hayResto = false;
  Object.keys(dia).forEach(function(k){ if(lista.indexOf(k) < 0){ resto[k] = dia[k]; hayResto = true; } });
  if(hayResto) o.diaMedio = resto; else delete o.diaMedio;
  ['tx', 'planes', 'fijos'].forEach(function(k){ if(Array.isArray(src[k])) o[k] = src[k].map(function(x){ return (x && typeof x === 'object') ? sal(x) : x; }); });
  if(Array.isArray(src.pases)) o.pases = src.pases.map(function(p){ var y = {}; Object.keys(p).forEach(function(k){ y[k] = p[k]; }); y.de = id(p.de); y.a = id(p.a); return y; });
  if(Array.isArray(src.cuentas)) o.cuentas = src.cuentas.map(function(c){ var y = {}; Object.keys(c).forEach(function(k){ y[k] = c[k]; }); if(c.medio) y.medio = id(c.medio); return y; });
  if(Array.isArray(src.viajes)) o.viajes = src.viajes.map(function(v){
    if(!v || !v.cargado || !v.cargado.medio) return v;
    var y = {}; Object.keys(v).forEach(function(k){ y[k] = v[k]; });
    y.cargado = { monto:v.cargado.monto, fecha:v.cargado.fecha, medio:id(v.cargado.medio) };
    return y;
  });
  return o;
}
// lo inverso, al abrir: cada id vuelve a ser su nombre. Datos viejos (medios como nombres) pasan sin tocar.
function desdeGuardado(o){
  if(!o || typeof o !== 'object' || !Array.isArray(o.medios) || !o.medios.some(function(m){ return m && typeof m === 'object'; })) return { o:o, reg:{} };
  var porId = {}, reg = {}, dia = {}, nombres = [];
  o.medios.forEach(function(m){
    var n = typeof m === 'string' ? m : (m && typeof m.nombre === 'string' ? m.nombre : '');
    n = n.trim().replace(/\s+/g, ' ').slice(0, 28);
    if(!n || nombres.indexOf(n) > -1) return;
    nombres.push(n);
    if(m && typeof m === 'object'){
      if(typeof m.id === 'string' && m.id){ porId[m.id] = n; reg[n] = m.id.slice(0, 24); }
      var d = parseInt(m.dia, 10); if(d >= 1 && d <= 31) dia[n] = d;
    }
  });
  var nom = function(v){ return (typeof v === 'string' && Object.prototype.hasOwnProperty.call(porId, v)) ? porId[v] : v; };
  var sal = function(x){
    var y = {}; Object.keys(x).forEach(function(k){ y[k] = x[k]; });
    if(typeof y.medio === 'string') y.medio = nom(y.medio);
    if(y.sal && typeof y.sal === 'object'){
      var r = {}; Object.keys(y.sal).forEach(function(k){ var v = y.sal[k]; r[k] = (v && typeof v === 'object') ? { t:v.t, de:nom(v.de), a:nom(v.a) } : v; });
      y.sal = r;
    }
    return y;
  };
  var c = {}; Object.keys(o).forEach(function(k){ c[k] = o[k]; });
  c.medios = nombres;
  ['tx', 'planes', 'fijos'].forEach(function(k){ if(Array.isArray(o[k])) c[k] = o[k].map(function(x){ return (x && typeof x === 'object') ? sal(x) : x; }); });
  if(Array.isArray(o.pases)) c.pases = o.pases.map(function(p){ if(!p || typeof p !== 'object') return p; var y = {}; Object.keys(p).forEach(function(k){ y[k] = p[k]; }); y.de = nom(p.de); y.a = nom(p.a); return y; });
  if(Array.isArray(o.cuentas)) c.cuentas = o.cuentas.map(function(x){ if(!x || typeof x !== 'object') return x; var y = {}; Object.keys(x).forEach(function(k){ y[k] = x[k]; }); y.medio = nom(x.medio); return y; });
  if(Array.isArray(o.viajes)) c.viajes = o.viajes.map(function(v){
    if(!v || !v.cargado || !v.cargado.medio) return v;
    var y = {}; Object.keys(v).forEach(function(k){ y[k] = v[k]; });
    y.cargado = { monto:v.cargado.monto, fecha:v.cargado.fecha, medio:nom(v.cargado.medio) };
    return y;
  });
  var dm = {}; Object.keys(dia).forEach(function(k){ dm[k] = dia[k]; });
  if(o.diaMedio && typeof o.diaMedio === 'object') Object.keys(o.diaMedio).forEach(function(k){ dm[nom(k)] = o.diaMedio[k]; });
  c.diaMedio = dm;
  return { o:c, reg:reg };
}
function writeLocal(){
  var a = AND(), js = JSON.stringify(paraGuardar(S));
  espacio.chars = js.length;
  if(a){ try{ a.guardar(js); }catch(e){} pintarEspacio(); return; }
  try{ localStorage.setItem(LS, js); espacio.fallo = false; }
  catch(e){ espacio.fallo = true; }
  pintarEspacio();
}
function textoMB(n){ var v = n / 1e6; return (v < 0.1 ? v.toFixed(2) : v.toFixed(1)).replace('.', ',') + ' MB'; }
function enNavegador(){ return !AND() && cloudReady && modo === 'local'; }
function pintarEspacio(){
  if(!espacio.chars && S) try{ espacio.chars = JSON.stringify(S).length; }catch(e){}
  var nav = enNavegador(), pct = espacio.chars / TOPE_NAV;
  var nota = $('#espacioNota');
  if(nota) nota.textContent = 'Tus datos ocupan ' + textoMB(espacio.chars)
    + (nav ? ', el ' + Math.min(100, Math.round(pct * 100)) + '% de los 5 MB, más o menos, que deja guardar el navegador.'
           : (modo === 'archivo' ? ' en el teléfono.' : '.'));
  var el = $('#avisoLleno'); if(!el) return;
  var nivel = !nav ? '' : (espacio.fallo ? 'lleno' : (pct >= CASI_NAV && !espacio.oculto ? 'casi' : ''));
  el.hidden = !nivel;
  el.classList.toggle('grave', nivel === 'lleno');
  if(!nivel) return;
  var chico = espacio.chars < 1000000, tit, txt;
  if(nivel === 'lleno'){
    tit = chico ? 'Este navegador no me deja guardar' : 'Se llenó la memoria del navegador';
    txt = (chico ? 'Puede ser una ventana privada, o que el navegador tenga bloqueados los datos de los sitios.'
                 : 'Tus datos ocupan ' + textoMB(espacio.chars) + ' y el navegador no acepta más.')
      + ' Lo que cargues desde ahora se pierde cuando cierres la página. Exportá una copia ya.';
  } else {
    tit = 'Se está llenando la memoria del navegador';
    txt = 'Tus datos ocupan ' + textoMB(espacio.chars) + ' y el navegador guarda hasta unos 5 MB. Exportá una copia cada tanto. Si se llena, te aviso acá.';
  }
  $('#avisoLlenoTit').textContent = tit;
  $('#avisoLlenoTxt').textContent = txt;
  $('#avisoLlenoOk').hidden = (nivel === 'lleno');
}
function normalize(o){
  var s = emptyState();
  if(!o || typeof o !== 'object') return s;
  var dg = desdeGuardado(o); o = dg.o;              // v292: los medios guardados por id
  Object.defineProperty(s, '_medId', { value:dg.reg, writable:true, configurable:true, enumerable:false });
  s.updatedAt = Number(o.updatedAt)||0;
  s.tx = Array.isArray(o.tx)? o.tx.filter(function(t){return t && t.id;}) : [];
  s.tx.forEach(function(t){
    if(t.mon === 'USD'){ t.mon = 'USD'; t.cot = Math.max(0, Number(t.cot)||0); }
    else { delete t.mon; delete t.cot; }
  });
  s.planes = Array.isArray(o.planes)? o.planes.filter(function(p){return p && p.id;}) : [];
  /* El día en que se debita cada cuota. Los planes de antes no lo tenían y
     caían el 1: se les deja el 1 para que ningún mes cambie de golpe. */
  s.planes.forEach(function(p){ p.dia = Math.min(31, Math.max(1, parseInt(p.dia,10) || 1)); });
  // el último día usado con cada tarjeta, para proponerlo la próxima vez
  s.diaMedio = {};
  if(o.diaMedio && typeof o.diaMedio === 'object'){
    Object.keys(o.diaMedio).forEach(function(k){
      var d = parseInt(o.diaMedio[k], 10);
      if(d >= 1 && d <= 31) s.diaMedio[String(k).slice(0,28)] = d;
    });
  }
  s.metas = Array.isArray(o.metas)? o.metas.filter(function(m){return m && m.id;}) : [];
  s.baseIngreso = Math.max(0, Number(o.baseIngreso)||0);
  /* Las categorías van ANTES de los grupos, porque `s.grupoDe` se arma
     recorriendo `s.catGasto`: si acá todavía estuviera la lista de fábrica, las
     categorías que agregaste vos quedarían afuera y su grupo se perdería en cada
     arranque. Fue exactamente ese el bug: "Juegos" volvía a "Otros" al reabrir. */
  if(Array.isArray(o.catGasto) && o.catGasto.length) s.catGasto = o.catGasto.slice();
  if(Array.isArray(o.catIng) && o.catIng.length) s.catIng = o.catIng.slice();
  s.catQuitadas = Array.isArray(o.catQuitadas) ? o.catQuitadas.filter(function(x){ return typeof x === 'string'; }) : [];
  sumarFaltantes(s.catGasto, CAT_GASTO, s.catQuitadas);
  sumarFaltantes(s.catIng, CAT_ING, s.catQuitadas);
  if(!s.catGasto.length) s.catGasto = ['Otros'];
  if(!s.catIng.length) s.catIng = ['Otros'];
  // los grupos
  s.grupos = [];
  if(Array.isArray(o.grupos)){
    o.grupos.forEach(function(g, i){
      if(!g || typeof g.id !== 'string' || !g.id) return;
      if(s.grupos.length >= MAX_GRUPOS) return;
      for(var k=0;k<s.grupos.length;k++) if(s.grupos[k].id === g.id) return;
      var nom = (typeof g.nombre === 'string' && g.nombre.trim()) ? g.nombre.trim().slice(0,28) : g.id;
      s.grupos.push({ id:g.id, nombre:nom, color: colorDeGuardado(g.color, i) });
    });
  }
  if(!s.grupos.length){
    // versiones anteriores: grupos fijos con nombre editable
    s.grupos = GRUPOS_DEF.map(function(g, i){
      var v = o.grupoNombre && o.grupoNombre[g.id];
      return { id:g.id, color:COLORES_BASE[i % COLORES_BASE.length].v,
               nombre:(typeof v === 'string' && v.trim()) ? v.trim().slice(0,28) : g.nombre };
    });
  }
  /* Los colores que te inventaste. Viven aparte de los grupos porque se
     reusan: podés pintar dos grupos con el mismo verde tuyo, y si borrás uno el
     color sigue estando a mano. */
  s.colores = [];
  if(Array.isArray(o.colores)) o.colores.forEach(function(v){
    var h = normHex(v);
    if(h && !esBasico(h) && s.colores.indexOf(h) < 0 && s.colores.length < MAX_COLORES) s.colores.push(h);
  });
  var idsG = {};
  s.grupos.forEach(function(g){ idsG[g.id] = true; });
  var fallbackG = s.grupos[s.grupos.length - 1].id;
  for(var fg=0; fg<s.grupos.length; fg++) if(s.grupos[fg].id === 'otros') fallbackG = 'otros';
  // a qué grupo pertenece cada categoría de gasto
  s.grupoDe = {};
  s.catGasto.forEach(function(c){
    var g = o.grupoDe && o.grupoDe[c];
    if(idsG[g]) s.grupoDe[c] = g;
    else s.grupoDe[c] = idsG[GRUPO_CAT[c]] ? GRUPO_CAT[c] : fallbackG;
  });
  // topes por grupo
  s.presuGrupo = {};
  if(o.presuGrupo && typeof o.presuGrupo === 'object'){
    s.grupos.forEach(function(g){
      var v = Number(o.presuGrupo[g.id])||0;
      if(v > 0) s.presuGrupo[g.id] = Math.min(100, v);
    });
  } else {
    // versiones anteriores: el tope era por categoría — lo sumo dentro de su grupo
    var porCat = {};
    if(o.presuPct && typeof o.presuPct === 'object'){
      Object.keys(o.presuPct).forEach(function(k){ var v = Number(o.presuPct[k])||0; if(v > 0) porCat[k] = v; });
    } else if(o.presupuestos && typeof o.presupuestos === 'object'){
      // aún más viejo: topes en pesos
      var topes = o.presupuestos, suma = 0;
      Object.keys(topes).forEach(function(k){ suma += Number(topes[k])||0; });
      var base = s.baseIngreso || ingresoUltimoMes(o.tx) || suma;
      if(base > 0) Object.keys(topes).forEach(function(k){
        var v = Number(topes[k])||0;
        if(v > 0) porCat[k] = Math.round(v/base*1000)/10;
      });
    }
    Object.keys(porCat).forEach(function(c){
      var g = s.grupoDe[c] || GRUPO_CAT[c] || 'otros';
      s.presuGrupo[g] = Math.min(100, (s.presuGrupo[g]||0) + porCat[c]);
    });
  }
  /* Los topes en pesos duros. Un grupo tiene tope porcentual O tope fijo, nunca
     los dos: si por lo que sea llegaran juntos, manda el fijo, que es el que
     escribiste en plata. Los datos de antes no tienen este campo y quedan todos
     porcentuales, que es como venían funcionando. */
  s.presuFijo = {};
  if(o.presuFijo && typeof o.presuFijo === 'object'){
    s.grupos.forEach(function(g){
      var v = Math.max(0, Number(o.presuFijo[g.id])||0);
      if(v > 0){ s.presuFijo[g.id] = Math.round(v * 100) / 100; delete s.presuGrupo[g.id]; }
    });
  }
  s.orden = [];
  if(Array.isArray(o.orden)) o.orden.forEach(function(k){
    if(PANELES.indexOf(k) > -1 && s.orden.indexOf(k) < 0) s.orden.push(k);
  });
  PANELES.forEach(function(k){ if(s.orden.indexOf(k) < 0) s.orden.push(k); });
  // medios de pago: editables como las categorías
  s.medios = Array.isArray(o.medios)
    ? o.medios.filter(function(x){ return typeof x === 'string' && x.trim(); })
              .map(function(x){ return x.trim().replace(/\s+/g,' ').slice(0,28); })
    : [];
  s.mediosQuitados = Array.isArray(o.mediosQuitados) ? o.mediosQuitados.filter(function(x){ return typeof x === 'string'; }) : [];
  s.medios = s.medios.filter(function(x, i){ return s.medios.indexOf(x) === i; });
  sumarFaltantes(s.medios, MEDIOS, s.mediosQuitados);
  mediosUsados(s);
  if(!s.medios.length) s.medios = MEDIOS.slice();
  /* Pases entre medios de pago: plata que cambia de lugar. No es un ingreso ni
     un gasto, así que vive aparte de `tx` y ningún total del mes la ve. */
  s.pases = (Array.isArray(o.pases) ? o.pases : []).filter(function(p){
    return p && typeof p.id === 'string' && p.id && typeof p.de === 'string' && typeof p.a === 'string';
  }).map(function(p){
    return { id:p.id.slice(0,24), ts:Number(p.ts)||0, fecha:(/^\d{4}-\d{2}-\d{2}$/.test(p.fecha) ? p.fecha : today()),
             monto:Math.max(0, Math.round((Number(p.monto)||0) * 100) / 100),
             de:p.de.trim().slice(0,28), a:p.a.trim().slice(0,28), nota:(typeof p.nota === 'string' ? p.nota.slice(0,60) : ''),
             quien:quienLimpio(p.quien) };
  }).filter(function(p){ return p.monto > 0 && p.de && p.a && p.de !== p.a; });
  /* Horas extras anotadas día por día: { id, ts, fecha, h:horas, pct:recargo }. */
  s.hx = (Array.isArray(o.hx) ? o.hx : []).filter(function(x){ return x && typeof x.id === 'string' && x.id; }).map(function(x){
    return { id:x.id.slice(0,24), ts:Number(x.ts)||0, fecha:(/^\d{4}-\d{2}-\d{2}$/.test(x.fecha) ? x.fecha : today()),
             h:Math.max(0, Math.min(24, Math.round((Number(x.h)||0) * 100) / 100)),
             pct:Math.max(0, Math.min(500, Math.round((Number(x.pct)||0) * 100) / 100)), quien:quienLimpio(x.quien) };
  }).filter(function(x){ return x.h > 0; });
  s.hxHoras = (Number(o.hxHoras) > 0 && Number(o.hxHoras) <= 400) ? Number(o.hxHoras) : 200;
  // v248: en qué mes se anotan ('este', 'sig' o 'auto'). Clave nueva: la `hxCobro` de v246 quedaba en 0 de fábrica y se tomaba como elegida.
  s.hxMes = (o.hxMes === 'este' || o.hxMes === 'sig') ? o.hxMes : 'auto';
  s.pases.forEach(function(p){
    if(s.medios.indexOf(p.de) === -1) s.medios.push(p.de);
    if(s.medios.indexOf(p.a) === -1) s.medios.push(p.a);
  });
  s.metas.forEach(function(m){
    if(!Array.isArray(m.aportes)) m.aportes = [];
    m.aportes.forEach(function(a){
      if(!a) return;
      if(a.mon !== 'USD' && a.mon !== 'ARS') delete a.mon;
      a.cot = Math.max(0, Number(a.cot)||0);
    });
    /* El punto de partida dejó de tener una sola moneda: ahora son dos montos,
       pesos y dólares, y la meta puede tener de los dos. En los datos viejos
       `inicial` estaba en la moneda de la meta, así que el de una meta en
       dólares se muda a `inicialUsd`. Corre una sola vez: después `inicialUsd`
       ya existe. */
    m.moneda = (m.moneda === 'USD') ? 'USD' : 'ARS';
    if(m.inicialUsd === undefined && m.moneda === 'USD'){
      m.inicialUsd = Math.max(0, Number(m.inicial)||0);
      m.inicial = 0;
    }
    m.inicial = Math.max(0, Number(m.inicial)||0);
    m.inicialUsd = Math.max(0, Number(m.inicialUsd)||0);
    // una meta con el objetivo en dólares igual puede tener pesos, y esos rinden
    m.rinde = (m.rinde === true);
    if(typeof m.cuenta !== 'string' || !m.cuenta) delete m.cuenta;
    /* Cada aporte dice DÓNDE está su plata: en una cuenta que rinde (`cuenta`, con
       `rinde:true`) o guardada aparte (`rinde:false`: efectivo, una caja). Antes
       eso lo decía la meta entera, con un solo botón. Los aportes de antes heredan
       lo que decía su meta, así ningún número cambia al abrir: la meta que rendía
       sigue rindiendo en la misma cuenta, y la que no, sigue sin rendir.
       `previo:true` es plata que ya tenías y se sumó a la meta después: tiene su
       fecha —rinde desde ese día— pero no es un movimiento de ese mes. */
    m.aportes.forEach(function(a){
      if(!a) return;
      if(typeof a.rinde !== 'boolean'){
        a.rinde = (m.rinde === true) && monAporte(m, a) !== 'USD';
        if(a.rinde && m.cuenta && typeof a.cuenta !== 'string') a.cuenta = m.cuenta;
      }
      if(monAporte(m, a) === 'USD') a.rinde = false;
      if(typeof a.cuenta !== 'string' || !a.cuenta || !a.rinde) delete a.cuenta;
      if(a.previo !== true) delete a.previo;
      if(a.parte !== true || a.previo !== true) delete a.parte;
      if(a.parte) a.mon = 'ARS';
    });
    // una parte de lo que ya tenías que quedó en cero no es nada: se va
    m.aportes = m.aportes.filter(function(a){ return a && !(a.parte && !((Number(a.monto)||0) > 0)); });
    // la fecha desde la que cuenta el "ya tenías ahorrado": si la meta es de
    // antes de que existiera este campo, uso su aporte más viejo
    if(typeof m.desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.desde)){
      var pri = '';
      (m.aportes||[]).forEach(function(a){
        if(typeof a.fecha === 'string' && (!pri || a.fecha < pri)) pri = a.fecha;
      });
      m.desde = pri || today();
    }
  });
  /* El dólar dejó de ser sólo el blue: se guarda la última cotización de cada
     tipo y cuál de todos elegiste. `venta` sigue siendo el vigente —es lo que
     usa toda la app— así que los datos viejos entran sin tocar nada: lo que
     tenían guardado era el blue. */
  var dl = o.dolar && typeof o.dolar === 'object' ? o.dolar : {};
  var tipos = {};
  if(dl.tipos && typeof dl.tipos === 'object'){
    DOLARES.forEach(function(d){
      var t = dl.tipos[d.id];
      if(!t || typeof t !== 'object') return;
      var v = Math.max(0, Number(t.venta)||0);
      if(v > 0) tipos[d.id] = { venta:v, fecha:(typeof t.fecha === 'string' ? t.fecha.slice(0,10) : '') };
      var co = Math.max(0, Number(t.compra)||0);
      if(v > 0 && co > 0) tipos[d.id].compra = co;
    });
  }
  s.dolar = {
    tipo: esTipoDolar(dl.tipo) ? dl.tipo : 'blue',
    venta: Math.max(0, Number(dl.venta)||0),
    fecha: typeof dl.fecha === 'string' ? dl.fecha.slice(0,10) : '',
    auto: !!dl.auto,
    tipos: tipos
  };
  if(!tipos[s.dolar.tipo] && s.dolar.venta > 0){
    s.dolar.tipos[s.dolar.tipo] = { venta:s.dolar.venta, fecha:s.dolar.fecha };
  }
  var otras = {};
  if(dl.otras && typeof dl.otras === 'object') MONEDAS.forEach(function(m){
    var t = dl.otras[m.id]; if(!t || typeof t !== 'object') return;
    var v = Math.max(0, Number(t.venta)||0); if(!(v > 0)) return;
    otras[m.id] = { venta:v, fecha:(typeof t.fecha === 'string' ? t.fecha.slice(0,10) : '') };
    var co = Math.max(0, Number(t.compra)||0); if(co > 0) otras[m.id].compra = co;
    if(t.mano) otras[m.id].mano = 1;
  });
  s.dolar.otras = otras;
  // gastos fijos y suscripciones
  s.fijos = [];
  if(Array.isArray(o.fijos)) o.fijos.forEach(function(f){
    if(!f || typeof f !== 'object' || !f.id) return;
    var esUsdFijo = (f.mon === 'USD');
    var precios = [];
    if(Array.isArray(f.precios)) f.precios.forEach(function(x){
      if(!x || !/^\d{4}-\d{2}$/.test(String(x.desde||''))) return;
      var m = Math.max(0, Number(x.monto)||0);
      if(m <= 0) return;
      var tr = { desde:x.desde, monto:m };
      if(esUsdFijo) tr.cot = Math.max(0, Number(x.cot)||0);
      precios.push(tr);
    });
    precios.sort(function(a,b){ return a.desde < b.desde ? -1 : 1; });
    if(!precios.length) return;
    s.fijos.push({
      id: String(f.id),
      nombre: (typeof f.nombre === 'string' && f.nombre.trim()) ? f.nombre.trim().slice(0,40) : 'Movimiento fijo',
      tipo: (f.tipo === 'ingreso') ? 'ingreso' : 'gasto',
      mon: esUsdFijo ? 'USD' : undefined,
      quien: quienLimpio(f.quien), med: medLimpio(f.med), rep: repLimpio(f.rep), por: quienLimpio(f.por),
      pend: f.pend ? 1 : undefined, pendDesde: /^\d{4}-\d{2}$/.test(String(f.pendDesde||'')) ? f.pendDesde : undefined, sal: salLimpio(f.sal),
      dia: (f.dia === 'primerHabil' || f.dia === 'ultimoHabil' || ((f.dia === 'quincena' || f.dia === 'nHabil') && f.tipo === 'ingreso'))
             ? f.dia : Math.min(31, Math.max(1, parseInt(f.dia,10) || 1)),
      // un gasto puede tener hora; uno por quincena, cuántos días hábiles después cae
      hora: (f.tipo !== 'ingreso' && vjHoraOk(f.hora)) ? f.hora : undefined,
      qhab: (f.dia === 'quincena' && f.tipo === 'ingreso') ? qhabDe(f) : undefined,
      nhab: (f.dia === 'nHabil' && f.tipo === 'ingreso') ? nhabDe(f) : undefined,
      cat: typeof f.cat === 'string' ? f.cat : '',
      medio: typeof f.medio === 'string' ? f.medio : '',
      desde: /^\d{4}-\d{2}$/.test(String(f.desde||'')) ? f.desde : precios[0].desde,
      hasta: /^\d{4}-\d{2}$/.test(String(f.hasta||'')) ? f.hasta : '',
      precios: precios,
      // los meses en que lo marcaste como pagado (o cobrado) en la lista del mes
      pag: pagLimpio(f.pag),
      // los meses que pagaste (o cobraste) antes de su día, y en qué fecha
      adel: adelLimpio(f.adel),
      // desde qué mes lo tachás vos (no se suma solo)
      man: /^\d{4}-\d{2}$/.test(String(f.man||'')) ? f.man : undefined,
      // v289: editado "desde este mes": el de antes sigue (`sig`) en el nuevo, que viene (`ant`) del viejo
      sig: (typeof f.sig === 'string' && f.sig) ? f.sig.slice(0, 40) : undefined,
      ant: (typeof f.ant === 'string' && f.ant) ? f.ant.slice(0, 40) : undefined
    });
  });

  // las cuentas que rinden
  s.tasas = [];
  if(Array.isArray(o.tasas)){
    o.tasas.forEach(function(t){
      if(!t || typeof t.n !== 'string' || !t.n) return;
      s.tasas.push({ n:t.n.slice(0,40), api:(typeof t.api === 'string' ? t.api : t.n),
                     tna:Math.max(0, Number(t.tna)||0), tipo:(t.tipo === 'billetera' ? 'billetera' : 'banco'),
                     fuente:(t.fuente === 'api' ? 'api' : 'mano'), fija: t.fija ? true : undefined,
                     busca:(typeof t.busca === 'string' ? t.busca : undefined),
                     al:(typeof t.al === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.al) ? t.al : undefined) });
    });
  }
  /* Antes del merge: versiones viejas guardaban la entidad por su nombre visible,
     y a algunas les cambié el identificador cuando separé los productos. */
  var TA_ALIAS = { 'uala-cuenta':'uala-ahorro', 'mercadopago':'mp-fondo',
                   'lemoncash':'lemon', 'cocos':'cocos-ah' };
  var elegida = typeof (o.tasa && o.tasa.entidad) === 'string' ? o.tasa.entidad : '';
  if(elegida){
    var esApi = false, porNombre = '';
    s.tasas.forEach(function(x){
      if(x.api === elegida) esApi = true;
      if(x.n === elegida && !porNombre) porNombre = x.api;
    });
    if(!esApi && porNombre) elegida = porNombre;
    if(TA_ALIAS[elegida]) elegida = TA_ALIAS[elegida];
  }

  /* El catálogo de entidades viaja con la app, no con tus datos: si en una
     versión nueva agregué o saqué billeteras, se tienen que ver. Se respetan las
     tasas que fijaste vos (`fija`) y los bancos que haya sumado la actualización
     automática; las billeteras que ya no están en el catálogo se van. */
  var porApi = {}, enDef = {};
  var migTasas = !!(o.tasa && o.tasa.mig >= 287);
  s.tasas.forEach(function(t){ porApi[String(t.api).toLowerCase()] = t; });
  TASAS_DEF.forEach(function(d){
    var k = String(d.api).toLowerCase();
    enDef[k] = true;
    var v = porApi[k];
    if(v){
      v.n = d.n; v.tipo = d.tipo; v.busca = d.busca;
      /* v287: antes, cada vez que se abría la app la tasa volvía a la de fábrica y
         recién después la pisaba la actualización. Si ese día no llegaba nada,
         quedaba la de fábrica. Ahora se queda la última que llegó (`al`), salvo
         que la de fábrica sea más nueva. */
      if(!v.fija){ if(!(v.al && v.al >= TASAS_FECHA)){ v.tna = d.tna; v.fuente = d.fuente; delete v.al; } }
      /* v287: una tasa "fijada" casi igual a la de fábrica es de cuando se tocaba la
         casilla sin querer: vuelve a ser automática. Una sola vez por dispositivo. */
      else if(!migTasas && Math.abs(v.tna - d.tna) <= 0.1){ delete v.fija; v.tna = d.tna; v.fuente = d.fuente; }
    } else {
      s.tasas.push({ n:d.n, api:d.api, tna:d.tna, tipo:d.tipo, fuente:d.fuente, busca:d.busca });
    }
  });
  s.tasas = s.tasas.filter(function(t){
    return t.tipo !== 'billetera' || enDef[String(t.api).toLowerCase()];
  });

  var ta = o.tasa && typeof o.tasa === 'object' ? o.tasa : {};
  s.tasa = {
    entidad: elegida.slice(0,40),
    tna: Math.max(0, Math.min(500, Number(ta.tna)||0)),
    manual: !!ta.manual,
    fecha: typeof ta.fecha === 'string' ? ta.fecha.slice(0,10) : TASAS_FECHA,
    mig: 287
  };
  // si la entidad elegida ya no existe en el catálogo, mejor vacía que fantasma
  if(s.tasa.entidad){
    var sigue = false;
    s.tasas.forEach(function(x){ if(x.api === s.tasa.entidad) sigue = true; });
    if(!sigue) s.tasa.entidad = '';
  }

  s.catRinde = Array.isArray(o.catRinde)
    ? o.catRinde.filter(function(c){ return typeof c === 'string' && c; }).slice(0,40)
    : [];

  /* Cuentas que rinden. Cada una es un medio de pago: lo que cargás con ese
     medio entra o sale de esa cuenta. Antes había una sola (`S.tasa` +
     `S.catRinde`), y después una lista con categorías de ingreso y medios
     marcados; las dos formas se migran acá. */
  s.cuentas = [];
  var viejas = Array.isArray(o.cuentas) ? o.cuentas : [];
  if(!viejas.length){
    var v0 = s.tasa || {};
    if(v0.entidad || v0.manual || (s.catRinde||[]).length){
      viejas = [{ entidad:v0.entidad, tna:v0.tna, manual:v0.manual, catIng:(s.catRinde||[]).slice(), medios:[] }];
    }
  }
  /* Con qué medio venía entrando la plata de esta cuenta: el que más usan los
     ingresos de sus categorías marcadas. Si lo encuentro, la cuenta se queda con
     ESE medio y después se lo renombra al del banco —así los movimientos que ya
     tenías lo siguen y la cuenta no se queda sin saldo. */
  function medioHeredado(c){
    var cats = c && Array.isArray(c.catIng) ? c.catIng : [];
    if(!cats.length) return '';
    var cuenta = {};
    function sumar(m){ m = m || ''; if(m) cuenta[m] = (cuenta[m]||0) + 1; }
    (s.tx||[]).forEach(function(t){ if(t.tipo === 'ingreso' && cats.indexOf(t.cat||'') !== -1) sumar(t.medio); });
    (s.fijos||[]).forEach(function(f){ if(f.tipo === 'ingreso' && cats.indexOf(f.cat||'') !== -1) sumar(f.medio); });
    var mejor = '', n = 0;
    Object.keys(cuenta).forEach(function(k){ if(cuenta[k] > n){ n = cuenta[k]; mejor = k; } });
    return mejor;
  }
  /* Renombrar un medio adentro de la migración: los movimientos lo siguen, así
     la cuenta no se queda sin el saldo que ya venía rindiendo. */
  function renombrarMedioEn(viejo, nuevo){
    if(!viejo || viejo === nuevo) return;
    var i = s.medios.indexOf(viejo);
    if(i > -1) s.medios[i] = nuevo; else if(s.medios.indexOf(nuevo) === -1) s.medios.push(nuevo);
    (s.tx||[]).forEach(function(t){ if((t.medio||'') === viejo) t.medio = nuevo; });
    (s.planes||[]).forEach(function(p){ if((p.medio||'') === viejo) p.medio = nuevo; });
    (s.fijos||[]).forEach(function(f){ if((f.medio||'') === viejo) f.medio = nuevo; });
    if(MEDIOS.indexOf(viejo) > -1 && s.mediosQuitados.indexOf(viejo) < 0) s.mediosQuitados.push(viejo);
    var k = s.mediosQuitados.indexOf(nuevo);
    if(k > -1) s.mediosQuitados.splice(k, 1);
  }
  function nombreDelBanco(api){
    var n = '';
    s.tasas.forEach(function(x){ if(x.api === api) n = x.n; });
    return String(n).replace(/\s*\([^)]*\)\s*$/, '').trim().slice(0,28);
  }
  viejas.forEach(function(c){
    if(!c || typeof c !== 'object') return;
    if(s.cuentas.length >= MAX_CUENTAS) return;
    var medio = typeof c.medio === 'string' ? c.medio.trim().slice(0,28) : '';
    var deLaVieja = !medio;                       // venía de la forma anterior
    if(!medio) medio = medioHeredado(c);
    if(!medio && Array.isArray(c.medios) && typeof c.medios[0] === 'string') medio = c.medios[0];
    /* Una sola vez, al migrar: el medio pasa a llamarse como el banco. Si ese
       nombre ya lo usa otro medio distinto, dejo el que había —renombrar sería
       fusionar dos medios que el usuario tiene separados a propósito—. */
    if(deLaVieja){
      var banco = nombreDelBanco(c.entidad);
      var libre = true;
      s.medios.forEach(function(m){ if(m !== medio && m.toLowerCase() === banco.toLowerCase()) libre = false; });
      if(banco && libre){
        if(medio) renombrarMedioEn(medio, banco);
        else if(s.medios.indexOf(banco) === -1) s.medios.push(banco);
        medio = banco;
      }
    }
    s.cuentas.push({
      id: (typeof c.id === 'string' && c.id) ? c.id : uid(),
      entidad: typeof c.entidad === 'string' ? c.entidad : '',
      tna: Math.max(0, Number(c.tna)||0),
      manual: !!c.manual,
      medio: medio
    });
  });
  if(!s.cuentas.length) s.cuentas.push({ id:uid(), entidad:'', tna:0, manual:false, medio:'' });
  // dos cuentas no pueden compartir medio: el saldo sería de las dos a la vez
  var vistos = {};
  s.cuentas.forEach(function(c){
    var k = (c.medio||'').toLowerCase();
    if(!k) return;
    if(vistos[k]) c.medio = ''; else vistos[k] = true;
  });
  // el medio de una cuenta tiene que existir en la lista de medios
  s.cuentas.forEach(function(c){
    if(c.medio && s.medios.indexOf(c.medio) === -1) s.medios.push(c.medio);
  });

  /* El recordatorio para cargar los gastos. Se guarda la regla, no la próxima
     fecha: la hora exacta la resuelve quien avisa —Android con su alarma, el
     navegador con un temporizador— cada vez que arranca. */
  var av = (o.aviso && typeof o.aviso === 'object') ? o.aviso : {};
  var avH = parseInt(av.hora, 10), avM = parseInt(av.min, 10);
  s.aviso = {
    on: av.on === true,
    hora: (avH >= 0 && avH <= 23) ? avH : 21,
    min: (avM >= 0 && avM <= 59 && avM % 5 === 0) ? avM : 0,
    dias: (av.dias === 'habiles') ? 'habiles' : 'todos',
    saltar: av.saltar !== false
  };

  /* Lo que ya tenías, con la forma de ahora: si la meta dice "no rinde" pero una
     parte está en una cuenta, esa cuenta pasa a ser la principal y lo suelto
     pasa a ser la parte en efectivo. Es la misma plata en los mismos lugares
     —ningún número cambia—, sólo que así se puede ver y tocar con el interruptor. */
  var ctaOk = {};
  s.cuentas.forEach(function(c){ if(c.medio) ctaOk[c.id] = true; });
  s.metas.forEach(function(m){
    if(m.rinde === true) return;
    var pr = null;
    m.aportes.forEach(function(a){ if(!pr && a.parte && a.rinde && ctaOk[a.cuenta]) pr = a; });
    if(!pr) return;
    var suelto = Math.max(0, Number(m.inicial)||0);
    m.aportes.forEach(function(a){ if(a.parte && !a.rinde){ suelto += Number(a.monto)||0; } });
    m.aportes = m.aportes.filter(function(a){ return a !== pr && !(a.parte && !a.rinde); });
    m.inicial = Number(pr.monto)||0;
    m.rinde = true; m.cuenta = pr.cuenta;
    if(suelto > 0) m.aportes.push({ id:uid(), ts:Date.now(), monto:Math.round(suelto*100)/100, fecha:m.desde,
                                    cot:0, mon:'ARS', previo:true, parte:true, rinde:false });
  });

  // el saldo que pasa de un mes al otro
  s.arrastreModo = (o.arrastreModo === 'siempre' || o.arrastreModo === 'nunca') ? o.arrastreModo : 'preguntar';
  s.viajes = (Array.isArray(o.viajes) ? o.viajes : []).map(vjLimpio).filter(Boolean).slice(0,30);
  // los viajes terminados hace más de 30 días: un resumen para la lista y el
  // viaje entero guardado como un solo texto, que se abre sólo si lo mirás
  s.vjHist = (Array.isArray(o.vjHist) ? o.vjHist : []).map(vjHistLimpio).filter(Boolean).slice(-300);
  s.vjArch = {};
  if(o.vjArch && typeof o.vjArch === 'object') s.vjHist.forEach(function(h){
    var x = o.vjArch[h.id]; if(typeof x === 'string' && x.length < 3000000) s.vjArch[h.id] = x;
  });
  if(typeof o.nsk === 'string' && /^[0-9a-f]{64}$/.test(o.nsk)) s.nsk = o.nsk;
  // la marca que une estos datos con lo anotado de la última sincronización (ver dbLeerCache)
  if(typeof o.dbMarca === 'string' && o.dbMarca) s.dbMarca = o.dbMarca.slice(0, 24);
  s.personas = personasLimpias(o.personas);
  s.reparto = repartoLimpio(o.reparto);
  s.famCero = famCeroLimpio(o.famCero);
  var sy = dvLimpio(o.sy); if(sy) s.sy = sy;
  s.arrastre = {};
  if(o.arrastre && typeof o.arrastre === 'object'){
    Object.keys(o.arrastre).forEach(function(k){
      if(/^\d{4}-\d{2}$/.test(k)) s.arrastre[k] = !!o.arrastre[k];
    });
  }
  return s;
}

function save(){
  S.updatedAt = Date.now();
  arrOlvidar();
  if(miPersona()) etiquetar();
  if(dvActivo()) dvMarcar();
  writeLocal();
  dbProgramar();                 // a la base: sube sólo lo que cambió (ver base-de-datos.js)
  nsRevisarPronto();
  if(!cloudReady || modo !== 'nube') return;
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1200);
}
function flush(){
  if(!cloud || modo!=='nube') return;
  if(saving){ pending = true; return; }
  saving = true;
  var files = {}; files[DATA_PATH] = JSON.stringify(paraGuardar(sinSy()));
  cloud.publish(files).then(function(){
    saving = false;
    if(pending){ pending = false; flush(); }
  }).catch(function(err){
    saving = false; pending = false;
    var code = (err && err.code) || 'upstream_error';
    if(code==='conflict'){ toast('Alguien más guardó cambios. Recargá la página para verlos.'); }
    else if(code==='rate_limited'){ setTimeout(flush, 4000); }
    else if(code==='upstream_error'){ setTimeout(flush, 3000); }
    else { modo='local'; renderAjustes(); }
  });
}

function initStore(){
  var crudo = readLocal();
  var local = normalize(crudo);
  S = local;
  // v292: datos de antes, con los medios por nombre: se guardan ya con ids
  if(crudo && Array.isArray(crudo.medios) && crudo.medios.some(function(m){ return typeof m === 'string'; })) writeLocal();
  fillSelects();
  render();
  aplicarOrden();

  if(AND()){
    // En el APK los datos viven en un archivo JSON de la app: no hay nube que consultar.
    cloudReady = true; modo = 'archivo';
    renderAjustes();
    try{ AND().copiaAutomatica(JSON.stringify(paraGuardar(sinSy()))); }catch(e){}
    traerDolar();
    traerTasas();
    traerFeriados();
    traerIpc();
    vjDelLink();
    nsRevisar();
    vjArchivarViejos();
    return;
  }

  // En la web: los datos de este navegador ya están en pantalla. Si hay una cuenta
  // abierta, cuentaArrancar() (en arranque.js) trae después lo de la base.
  cloudReady = true;
  modo = cuentaHayBase() ? 'base' : 'local';
  renderAjustes();
  traerDolar();
  traerTasas();
  traerFeriados();
  traerIpc();
  vjDelLink();
  nsRevisar();
  vjArchivarViejos();
}
