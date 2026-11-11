/* Cuentas Claras · js/base-de-datos.js
   La capa de datos: pasa lo que la app tiene en memoria (S) a las tablas de la
   base y al revés.

   Cómo funciona
   · La app sigue trabajando con S en memoria, igual que siempre.
   · Al entrar, se leen las filas del espacio del usuario y con ellas se arma S.
   · Al guardar, S se convierte en filas, se compara con lo que ya está en la
     base y se sube sólo lo que cambió (alta, cambio o baja de cada fila).
   · Cada tabla tiene columnas para lo importante (clave, relaciones, monto,
     fecha…) y una columna "extra" con los datos internos de la app.
   · Si otro usuario del grupo cambia algo, llega un aviso y se vuelve a leer.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

var db = null;                 // el cliente de Supabase
var dbSes = { usuario:'', email:'', espacio:'', propio:'', persona:'', creador:'', codigo:'', miembros:[], canal:null };
var dbUlt = {};                // tabla → { clave: huella } de lo que hay en la base
var dbOrd = {};                // tabla → { clave: orden } de las listas largas
var dbEst = { listo:false, subiendo:false, otra:false, trayendo:false, pendiente:false, error:'', reintento:0, tSubir:null, tTraer:null };
var DB_LS_CACHE = 'cc-db-cache', DB_LS_QUIEN = 'cc-db-quien';
var DB_SEP = '\u001f';         // separa las partes de una clave compuesta

function dbActiva(){ return !!(db && dbSes.usuario && dbSes.espacio); }

/* ---- qué va en cada tabla ----
   campos: [campo en la app, columna, tipo, valor si falta (o tabla, en una relación)].
   orden: 'indice' = la posición en la lista; 'registro' = el orden en que se cargó
   (así, borrar uno del medio no obliga a reescribir los demás). */
var DB_LISTAS = [
  { tabla:'personas', de:'personas', sinExtra:true, orden:'indice',
    campos:[['id','id','txt'], ['n','nombre','txt',''], ['c','se_sumo_el','ms'], ['t','modificado_el','ms'], ['fuera','fuera','flag']] },
  { tabla:'medios_pago', de:'medios', sinExtra:true, orden:'indice',
    campos:[['id','id','txt'], ['nombre','nombre','txt',''], ['dia','dia_cuotas','chico']] },
  { tabla:'grupos_categorias', de:'grupos', sinExtra:true, orden:'indice',
    campos:[['id','id','txt'], ['nombre','nombre','txt',''], ['color','color','txt']] },
  { tabla:'cuentas_rinden', de:'cuentas', orden:'indice',
    campos:[['id','id','txt'], ['entidad','entidad','txt'], ['tna','tna','num'], ['manual','manual','bool'], ['medio','medio_id','ref','medios_pago']] },
  { tabla:'movimientos', de:'tx', orden:'registro',
    campos:[['id','id','txt'], ['tipo','tipo','tipo','gasto'], ['monto','monto','num',0], ['mon','moneda','txt'], ['cot','cotizacion','num'],
            ['fecha','fecha','fecha'], ['cat','categoria','cat'], ['medio','medio_id','ref','medios_pago'], ['nota','nota','txt'],
            ['quien','persona_id','ref','personas'], ['por','cargado_por','txt'], ['med','a_medias','json'], ['viaje','viaje_id','txt']] },
  { tabla:'compras_cuotas', de:'planes', orden:'registro', fijo:{ tipo:'gasto' },
    campos:[['id','id','txt'], ['desc','descripcion','txt'], ['total','total','num',0], ['n','cuotas','ent',1], ['dia','dia','chico'],
            ['desde','primer_mes','txt'], ['cat','categoria','cat'], ['medio','medio_id','ref','medios_pago'],
            ['quien','persona_id','ref','personas'], ['med','a_medias','json']] },
  { tabla:'gastos_fijos', de:'fijos', orden:'registro',
    campos:[['id','id','txt'], ['tipo','tipo','tipo','gasto'], ['nombre','nombre','txt',''], ['dia','cuando','dia'], ['cat','categoria','cat'],
            ['medio','medio_id','ref','medios_pago'], ['quien','persona_id','ref','personas'], ['desde','desde','txt'], ['hasta','hasta','txt'],
            ['mon','moneda','txt'], ['med','a_medias','json']],
    hijos:[{ tabla:'precios_fijo', de:'precios', padre:'fijo_id', porIndice:true, sinExtra:true,
             campos:[['desde','desde','txt',''], ['monto','monto','num',0], ['cot','cotizacion','num']] }] },
  { tabla:'pases', de:'pases', orden:'registro',
    campos:[['id','id','txt'], ['fecha','fecha','fecha'], ['monto','monto','num',0], ['de','medio_origen','ref','medios_pago'],
            ['a','medio_destino','ref','medios_pago'], ['nota','nota','txt'], ['quien','persona_id','ref','personas']] },
  { tabla:'metas_ahorro', de:'metas', orden:'indice',
    campos:[['id','id','txt'], ['nombre','nombre','txt',''], ['objetivo','objetivo','num'], ['moneda','moneda','txt'], ['desde','desde','fecha'],
            ['cuenta','cuenta_id','ref','cuentas_rinden']],
    hijos:[{ tabla:'aportes', de:'aportes', padre:'meta_id', orden:'registro',
             campos:[['id','id','txt'], ['monto','monto','num',0], ['fecha','fecha','fecha'], ['mon','moneda','txt'], ['cot','cotizacion','num'],
                     ['cuenta','cuenta_id','ref','cuentas_rinden'], ['quien','persona_id','ref','personas']] }] },
  { tabla:'horas_extras', de:'hx', orden:'registro',
    campos:[['id','id','txt'], ['fecha','fecha','fecha'], ['h','horas','num',0], ['pct','recargo','num'], ['quien','persona_id','ref','personas']] },
  { tabla:'viajes', de:'viajes', orden:'indice', locales:['sync', 'vis'],   // (cuándo se publicó y qué vio: es de cada navegador)
    campos:[['id','id','txt'], ['nombre','nombre','txt',''], ['clave','clave','txt'], ['creado','creado_el','ms']],
    hijos:[{ tabla:'viaje_miembros', de:'miembros', padre:'viaje_id', orden:'indice', campoId:'i',
             campos:[['i','id','txt'], ['n','nombre','txt','']] },
           { tabla:'viaje_gastos', de:'gastos', padre:'viaje_id', orden:'indice', campoId:'i',
             campos:[['i','id','txt'], ['pag','pagado_por','refLocal','miembros'], ['mo','monto','num',0], ['d','descripcion','txt'],
                     ['c','categoria','txt'], ['f','fecha','fecha']] }] }
];
// de las que dependen otras, primero: así se suben en un orden que respeta las relaciones
var DB_ORDEN = ['personas', 'medios_pago', 'grupos_categorias', 'categorias', 'cuentas_rinden', 'movimientos', 'compras_cuotas',
                'gastos_fijos', 'precios_fijo', 'pases', 'metas_ahorro', 'aportes', 'horas_extras', 'viajes', 'viaje_miembros',
                'viaje_gastos', 'ajustes'];
// las columnas de la clave de cada tabla, además de espacio_id
var DB_CLAVES = { categorias:['tipo', 'nombre'], precios_fijo:['fijo_id', 'orden'], aportes:['meta_id', 'id'],
                  viaje_miembros:['viaje_id', 'id'], viaje_gastos:['viaje_id', 'id'], ajustes:[] };
DB_ORDEN.forEach(function(t){ if(!DB_CLAVES[t]) DB_CLAVES[t] = ['id']; });
// lo que la capa de datos reparte en tablas, y lo que es de cada dispositivo y no se sube
var DB_EN_TABLAS = ['medios', 'catGasto', 'catIng', 'grupoDe', 'grupos', 'personas', 'tx', 'planes', 'fijos', 'pases', 'cuentas', 'metas', 'hx', 'viajes'];
var DB_LOCALES = ['tasas', 'tasa', 'dolar', 'sy', 'nsk', 'updatedAt', 'dbMarca'];

/* ---- tipos de columna: cuándo un dato es válido y cómo se convierte ---- */
function dbFechaOk(v){
  if(typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  var d = new Date(v + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === v && v >= '1900-01-01';
}
function dbEntero(v, tope){ return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && Math.abs(v) <= tope; }
var DB_TIPO = {
  txt:   { ok:function(v){ return typeof v === 'string'; } },
  num:   { ok:function(v){ return typeof v === 'number' && isFinite(v); } },
  ent:   { ok:function(v){ return dbEntero(v, 2000000000); } },
  chico: { ok:function(v){ return dbEntero(v, 32000); } },
  bool:  { ok:function(v){ return typeof v === 'boolean'; } },
  flag:  { ok:function(v){ return v === 1 || v === true; }, a:function(){ return true; }, de:function(v){ return v ? 1 : undefined; }, falta:false },
  fecha: { ok:dbFechaOk },
  ms:    { ok:function(v){ return dbEntero(v, 8e15) && v >= 0; }, a:function(v){ return new Date(v).toISOString(); }, de:function(v){ return Date.parse(v); } },
  dia:   { ok:function(v){ return dbEntero(v, 31) || (typeof v === 'string' && v !== '' && !/^\d+$/.test(v)); },
           a:function(v){ return String(v); }, de:function(v){ return /^\d+$/.test(v) ? Number(v) : v; } },
  tipo:  { ok:function(v){ return v === 'gasto' || v === 'ingreso'; } },
  cat:   { ok:function(v){ return typeof v === 'string' && v !== ''; } },
  json:  { ok:function(v){ return v !== null && typeof v === 'object'; } }
};

/* ---- huella de una fila: para saber si cambió sin guardar la fila entera ---- */
function dbCanon(x){
  if(x === null || typeof x !== 'object') return JSON.stringify(x === undefined ? null : x);
  if(Array.isArray(x)) return '[' + x.map(dbCanon).join(',') + ']';
  return '{' + Object.keys(x).sort().filter(function(k){ return x[k] !== undefined; })
    .map(function(k){ return JSON.stringify(k) + ':' + dbCanon(x[k]); }).join(',') + '}';
}
function dbHuella(fila){
  var s = dbCanon(fila), a = 2166136261, b = 5381;
  for(var i = 0; i < s.length; i++){ var c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = (Math.imul(b, 33) + c) | 0; }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36) + s.length.toString(36);
}
function dbClave(tabla, fila){ return DB_CLAVES[tabla].map(function(c){ return String(fila[c]); }).join(DB_SEP); }

/* ---- de la app a filas ---- */
function dbOrdenDe(tabla, clave){
  var reg = dbOrd[tabla] || (dbOrd[tabla] = {});
  if(reg[clave] === undefined){
    var max = 0; Object.keys(reg).forEach(function(k){ if(reg[k] > max) max = reg[k]; });
    reg[clave] = max + 1;
  }
  return reg[clave];
}
function dbFila(sp, item, i, padre, ctx){
  var f = { espacio_id:dbSes.espacio }, extra = {}, usados = {};
  Object.keys(padre).forEach(function(k){ f[k] = padre[k]; });
  if(sp.fijo) Object.keys(sp.fijo).forEach(function(k){ f[k] = sp.fijo[k]; });
  if(sp.porIndice) f.orden = i;
  else {
    var id = item[sp.campoId || 'id'];
    if(typeof id !== 'string' || !id) return null;
  }
  sp.campos.forEach(function(c){
    var campo = c[0], col = c[1], tipo = c[2], v = item[campo];
    var esRef = (tipo === 'ref' || tipo === 'refLocal'), T = DB_TIPO[tipo];
    var falta = (!esRef && c.length > 3) ? c[3] : (T && T.falta !== undefined ? T.falta : null);
    usados[campo] = 1;
    if(v === undefined){ f[col] = falta; return; }
    var ok = tipo === 'ref' ? (typeof v === 'string' && !!ctx.ids[c[3]][v])
           : tipo === 'refLocal' ? (typeof v === 'string' && !!(ctx.local[c[3]] || {})[v])
           : T.ok(v);
    if(ok) f[col] = (T && T.a) ? T.a(v) : v;
    else { f[col] = falta; extra[campo] = v; }     // lo que no entra en la columna no se pierde: va en "extra"
    if(ok && tipo === 'cat') ctx.cats[f.tipo + DB_SEP + v] = 1;
  });
  (sp.hijos || []).forEach(function(h){ usados[h.de] = 1; });
  if(!sp.sinExtra){
    (sp.locales || []).forEach(function(k){ usados[k] = 1; });
    Object.keys(item).forEach(function(k){ if(!usados[k] && item[k] !== undefined) extra[k] = item[k]; });
    f.extra = extra;
  }
  if(!sp.porIndice){
    var clave = dbClave(sp.tabla, f);
    if(sp.orden === 'indice') f.orden = i;
    else if(sp.orden === 'registro') f.orden = dbOrdenDe(sp.tabla, clave);
  }
  return f;
}
function dbFilasLista(sp, lista, padre, ctx, out){
  (Array.isArray(lista) ? lista : []).forEach(function(item, i){
    if(!item || typeof item !== 'object') return;
    var f = dbFila(sp, item, i, padre, ctx); if(!f) return;
    var k = dbClave(sp.tabla, f);
    if(out[sp.tabla][k]) return;                     // un id repetido: queda el primero
    out[sp.tabla][k] = f;
    (sp.hijos || []).forEach(function(h){
      var p = {}; p[h.padre] = f.id;
      var ctx2 = { ids:ctx.ids, cats:ctx.cats, local:{} };
      // los gastos de un viaje sólo pueden apuntar a los miembros de ese viaje
      if(Array.isArray(item.miembros)){ ctx2.local.miembros = {}; item.miembros.forEach(function(m){ if(m && typeof m.i === 'string') ctx2.local.miembros[m.i] = 1; }); }
      dbFilasLista(h, item[h.de], p, ctx2, out);
    });
  });
}
/* g: los datos como se guardan (lo que devuelve paraGuardar). → { tabla: { clave: fila } } */
function dbFilas(g){
  var out = {}; DB_ORDEN.forEach(function(t){ out[t] = {}; });
  var ctx = { ids:{ medios_pago:{}, personas:{}, cuentas_rinden:{}, grupos_categorias:{} }, cats:{}, local:{} };
  function anotar(lista, tabla){ (Array.isArray(lista) ? lista : []).forEach(function(x){ if(x && typeof x.id === 'string' && x.id) ctx.ids[tabla][x.id] = 1; }); }
  anotar(g.medios, 'medios_pago'); anotar(g.personas, 'personas'); anotar(g.cuentas, 'cuentas_rinden'); anotar(g.grupos, 'grupos_categorias');
  DB_LISTAS.forEach(function(sp){ dbFilasLista(sp, g[sp.de], {}, ctx, out); });

  // categorías: las de las listas, y las que ya no están pero algún movimiento todavía nombra
  var grupoDe = (g.grupoDe && typeof g.grupoDe === 'object') ? g.grupoDe : {}, resto = {}, enLista = {};
  function catFila(tipo, nombre, orden, activa){
    var gr = tipo === 'gasto' ? grupoDe[nombre] : undefined;
    var f = { espacio_id:dbSes.espacio, tipo:tipo, nombre:nombre, grupo_id:(typeof gr === 'string' && ctx.ids.grupos_categorias[gr]) ? gr : null, orden:orden, activa:activa };
    if(f.grupo_id) enLista['gasto' + DB_SEP + nombre] = 2;
    var k = dbClave('categorias', f);
    if(!out.categorias[k]) out.categorias[k] = f;
  }
  [['gasto', g.catGasto], ['ingreso', g.catIng]].forEach(function(par){
    (Array.isArray(par[1]) ? par[1] : []).forEach(function(n, i){ if(typeof n === 'string' && n){ enLista[par[0] + DB_SEP + n] = enLista[par[0] + DB_SEP + n] || 1; catFila(par[0], n, i, true); } });
  });
  Object.keys(ctx.cats).forEach(function(k){ if(!enLista[k]){ var p = k.split(DB_SEP); catFila(p[0], p[1], 100000, false); } });
  // lo de grupoDe que no quedó en ninguna fila (categorías que ya no existen) viaja con los ajustes
  Object.keys(grupoDe).forEach(function(n){ if(enLista['gasto' + DB_SEP + n] !== 2) resto[n] = grupoDe[n]; });

  var datos = {};
  Object.keys(g).forEach(function(k){ if(DB_EN_TABLAS.indexOf(k) < 0 && DB_LOCALES.indexOf(k) < 0 && g[k] !== undefined) datos[k] = g[k]; });
  if(Object.keys(resto).length) datos.grupoDeResto = resto;
  out.ajustes[''] = { espacio_id:dbSes.espacio, datos:datos };
  return out;
}

/* ---- de filas a la app ---- */
function dbItem(sp, fila){
  var item = {};
  sp.campos.forEach(function(c){
    var v = fila[c[1]], T = DB_TIPO[c[2]];
    if(v === null || v === undefined) return;
    if(c[2] === 'num' && typeof v === 'string') v = Number(v);
    var x = (T && T.de) ? T.de(v) : v;
    if(x !== undefined) item[c[0]] = x;
  });
  if(!sp.sinExtra && fila.extra && typeof fila.extra === 'object') Object.keys(fila.extra).forEach(function(k){ item[k] = fila.extra[k]; });
  return item;
}
function dbPorOrden(tabla, filas){
  return (filas || []).slice().sort(function(a, b){
    var d = (Number(a.orden) || 0) - (Number(b.orden) || 0);
    if(d) return d;
    var ka = dbClave(tabla, a), kb = dbClave(tabla, b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}
function dbListaDe(sp, filas, padreId){
  var mias = dbPorOrden(sp.tabla, (filas[sp.tabla] || []).filter(function(f){ return !sp.padre || f[sp.padre] === padreId; }));
  return mias.map(function(f){
    var item = dbItem(sp, f);
    (sp.hijos || []).forEach(function(h){ item[h.de] = dbListaDe(h, filas, f.id); });
    return item;
  });
}
/* filas: { tabla: [filas] } → los datos como se guardan, listos para normalize() */
function dbDesdeFilas(filas){
  var total = 0; DB_ORDEN.forEach(function(t){ total += (filas[t] || []).length; });
  if(!total) return {};                               // una cuenta recién creada: arranca con lo de fábrica
  var aj = (filas.ajustes || [])[0], g = {};
  if(aj && aj.datos && typeof aj.datos === 'object') Object.keys(aj.datos).forEach(function(k){ g[k] = aj.datos[k]; });
  var resto = g.grupoDeResto || {}; delete g.grupoDeResto;
  DB_LISTAS.forEach(function(sp){ g[sp.de] = dbListaDe(sp, filas, null); });
  var cats = dbPorOrden('categorias', filas.categorias);
  g.catGasto = []; g.catIng = []; g.grupoDe = {};
  Object.keys(resto).forEach(function(n){ g.grupoDe[n] = resto[n]; });
  cats.forEach(function(c){
    if(c.activa !== false) (c.tipo === 'ingreso' ? g.catIng : g.catGasto).push(c.nombre);
    if(c.tipo === 'gasto' && c.grupo_id) g.grupoDe[c.nombre] = c.grupo_id;
  });
  return g;
}
function dbEnListas(mapa){ var o = {}; DB_ORDEN.forEach(function(t){ o[t] = Object.keys(mapa[t] || {}).map(function(k){ return mapa[t][k]; }); }); return o; }
function dbHuellas(mapa){ var o = {}; DB_ORDEN.forEach(function(t){ o[t] = {}; Object.keys(mapa[t] || {}).forEach(function(k){ o[t][k] = dbHuella(mapa[t][k]); }); }); return o; }

/* ---- lo que queda anotado en este navegador entre una visita y otra ---- */
function dbGuardarCache(){
  try{ localStorage.setItem(DB_LS_CACHE, JSON.stringify({ u:dbSes.usuario, e:dbSes.espacio, p:dbSes.persona, m:S.dbMarca || '', ult:dbUlt, ord:dbOrd })); }catch(e){}
}
function dbLeerCache(){
  try{
    var c = JSON.parse(localStorage.getItem(DB_LS_CACHE) || 'null');
    // la marca dice que esta anotación corresponde a los datos que están guardados en este navegador:
    // si faltaran (alguien limpió el navegador a medias), no hay que creer que el usuario los borró
    if(c && c.u === dbSes.usuario && c.e && c.m && c.m === S.dbMarca){ dbSes.espacio = c.e; dbSes.persona = c.p || ''; dbUlt = c.ult || {}; dbOrd = c.ord || {}; return true; }
  }catch(e){}
  return false;
}
/* Otro usuario, u otro espacio: lo que había en este navegador no sirve más. */
function dbOlvidarLocal(){
  dbUlt = {}; dbOrd = {}; dbEst.listo = false; dbEst.pendiente = false; dbEst.error = '';
  try{ localStorage.removeItem(DB_LS_CACHE); localStorage.removeItem(LS); }catch(e){}
  var loc = {}; ['tasas', 'tasa', 'dolar', 'nsk'].forEach(function(k){ if(S[k] !== undefined) loc[k] = S[k]; });
  S = emptyState();
  Object.keys(loc).forEach(function(k){ S[k] = loc[k]; });    // tasas y dólar ya bajados: son de este navegador, no de la cuenta
}

/* ---- leer ---- */
function dbLeerTabla(t){
  var filas = [], cols = DB_CLAVES[t];
  function pagina(desde){
    var q = db.from(t).select('*').eq('espacio_id', dbSes.espacio);
    cols.forEach(function(c){ q = q.order(c); });
    return q.range(desde, desde + 999).then(function(r){
      if(r.error) throw r.error;
      filas = filas.concat(r.data || []);
      return (r.data || []).length === 1000 ? pagina(desde + 1000) : filas;
    });
  }
  return pagina(0);
}
function dbLeerTodo(){
  return Promise.all(DB_ORDEN.map(dbLeerTabla)).then(function(l){ var o = {}; DB_ORDEN.forEach(function(t, i){ o[t] = l[i]; }); return o; });
}
/* El perfil, el espacio en el que está y quiénes más están. Devuelve si cambió de espacio. */
function dbLeerSesion(){
  var u = dbSes.usuario;
  return Promise.all([
    db.from('perfiles').select('nombre,espacio_actual').eq('id', u).maybeSingle(),
    db.from('espacios').select('id,codigo,creado_por')            // los permisos sólo dejan ver los espacios donde es miembro
  ]).then(function(r){
    if(r[0].error) throw r[0].error;
    if(r[1].error) throw r[1].error;
    var perfil = r[0].data, esp = r[1].data || [];
    if(!perfil) throw new Error('sin_perfil');
    var propio = esp.filter(function(e){ return e.creado_por === u; })[0];
    var actual = esp.filter(function(e){ return e.id === perfil.espacio_actual; })[0] || propio;
    if(!actual) throw new Error('sin_espacio');
    var cambio = dbSes.espacio !== actual.id;
    dbSes.propio = propio ? propio.id : ''; dbSes.espacio = actual.id; dbSes.codigo = actual.codigo || ''; dbSes.creador = actual.creado_por;
    var p = perfil.espacio_actual === actual.id ? Promise.resolve()
          : db.from('perfiles').update({ espacio_actual:actual.id }).eq('id', u).then(function(){});
    return p.then(function(){ return db.from('espacio_miembros').select('usuario_id,persona_id').eq('espacio_id', actual.id); })
      .then(function(m){
        if(m.error) throw m.error;
        dbSes.miembros = m.data || [];
        var yo = dbSes.miembros.filter(function(x){ return x.usuario_id === u; })[0];
        dbSes.persona = (yo && yo.persona_id) || '';
        return cambio;
      });
  });
}
/* Trae lo de la base y lo junta con lo que hubiera sin subir en este navegador.
   Para cada fila: si acá cambió desde la última vez, vale la de acá; si no, la de la base. */
function dbTraer(){
  if(!db || !dbSes.usuario) return Promise.resolve(false);
  if(dbEst.trayendo) return dbEst.pTraer;
  dbEst.trayendo = true; dbPintarEstado();
  // si justo se está subiendo algo, primero que termine: si no, se leería la base a medio escribir
  var nada = function(){}, antesDe = (dbEst.subiendo && dbEst.pSubir) ? dbEst.pSubir.then(nada, nada) : Promise.resolve();
  dbEst.pTraer = antesDe.then(dbLeerSesion).then(function(cambioEspacio){
    if(cambioEspacio && (Object.keys(dbUlt).length || dbEst.listo)) dbOlvidarLocal();
    dbCanal();
    return dbLeerTodo();
  }).then(function(filas){
    // lo de acá se pasa a filas antes de tocar nada: así se compara con lo que se sabía de la base
    var hayBase = Object.keys(dbUlt).length > 0, L = hayBase ? dbFilas(paraGuardar(sinSy())) : null;
    DB_LISTAS.forEach(function reg(sp){
      if(sp.orden === 'registro'){ dbOrd[sp.tabla] = {}; (filas[sp.tabla] || []).forEach(function(f){ dbOrd[sp.tabla][dbClave(sp.tabla, f)] = Number(f.orden) || 0; }); }
      (sp.hijos || []).forEach(reg);
    });
    var gR = dbDesdeFilas(filas), R = dbFilas(gR), hR = dbHuellas(R);
    var total = 0; DB_ORDEN.forEach(function(t){ total += (filas[t] || []).length; });
    if(!total){ R = {}; hR = {}; DB_ORDEN.forEach(function(t){ R[t] = {}; hR[t] = {}; }); }
    var g = gR, cambioLocal = false;
    if(hayBase){
      var M = {};
      DB_ORDEN.forEach(function(t){
        var ult = dbUlt[t] || {};
        M[t] = {}; Object.keys(R[t]).forEach(function(k){ M[t][k] = R[t][k]; });
        Object.keys(L[t]).forEach(function(k){
          if(ult[k] !== dbHuella(L[t][k]) && hR[t][k] !== dbHuella(L[t][k])){
            M[t][k] = L[t][k]; cambioLocal = true;
            if(dbOrd[t] && dbOrd[t][k] === undefined) dbOrd[t][k] = L[t][k].orden;   // conserva su lugar en la lista
          }
        });
        Object.keys(ult).forEach(function(k){ if(!(k in L[t]) && (k in M[t])){ delete M[t][k]; cambioLocal = true; } });
      });
      if(cambioLocal) g = dbDesdeFilas(dbEnListas(M));
    }
    DB_LOCALES.forEach(function(k){ if(k !== 'sy' && S[k] !== undefined) g[k] = S[k]; });
    // lo que cada lista tiene de este navegador y no va a la base, se conserva
    DB_LISTAS.forEach(function(sp){
      if(!sp.locales || !Array.isArray(g[sp.de])) return;
      var mios = {}; (S[sp.de] || []).forEach(function(x){ if(x && x.id) mios[x.id] = x; });
      g[sp.de].forEach(function(x){ var m = mios[x.id]; if(m) sp.locales.forEach(function(k){ if(m[k] !== undefined) x[k] = m[k]; }); });
    });
    var antes = dbCanon(paraGuardar(sinSy())), primera = !dbEst.listo;
    S = normalize(g);
    if(!S.dbMarca) S.dbMarca = uid();
    dbUlt = hR; dbEst.listo = true; dbEst.error = '';
    writeLocal(); dbGuardarCache();
    if(primera || antes !== dbCanon(paraGuardar(sinSy()))){ fillSelects(); render(); aplicarOrden(); }
    if(vista === 'familia') renderFamilia();
    cuentaPintarAjustes();
    dbEmpujar();                                       // si acá había algo sin subir (o es una cuenta nueva), va ahora
    return true;
  });
  var fin = function(){ dbEst.trayendo = false; dbPintarEstado(); };
  dbEst.pTraer.then(fin, fin);
  return dbEst.pTraer;
}
function dbTraerPronto(){ clearTimeout(dbEst.tTraer); dbEst.tTraer = setTimeout(function(){ dbTraer().catch(function(){}); }, 600); }

/* ---- guardar: sólo lo que cambió ---- */
function dbSubirPaso(paso, esp){
  var t = paso.t, tandas = [];
  if(paso.ups){
    for(var i = 0; i < paso.ups.length; i += 400) tandas.push(paso.ups.slice(i, i + 400));
    return tandas.reduce(function(p, filas){
      return p.then(function(){
        return db.from(t).upsert(filas, { onConflict:['espacio_id'].concat(DB_CLAVES[t]).join(',') }).then(function(r){
          if(r.error) throw r.error;
          dbUlt[t] = dbUlt[t] || {};
          filas.forEach(function(f){ var k = dbClave(t, f); dbUlt[t][k] = paso.hs[k]; });
        });
      });
    }, Promise.resolve());
  }
  // bajas: se agrupan por las primeras columnas de la clave y se borran de a varias por la última
  var cols = DB_CLAVES[t], grupos = {};
  paso.dels.forEach(function(k){
    var v = k.split(DB_SEP), pre = v.slice(0, -1).join(DB_SEP);
    (grupos[pre] || (grupos[pre] = [])).push(k);
  });
  var tareas = [];
  Object.keys(grupos).forEach(function(pre){
    var lote = (t === 'categorias') ? 1 : 100;         // un nombre de categoría puede traer comas o comillas: de a uno
    for(var j = 0; j < grupos[pre].length; j += lote) tareas.push(grupos[pre].slice(j, j + lote));
  });
  return tareas.reduce(function(p, claves){
    return p.then(function(){
      var v0 = claves[0].split(DB_SEP), q = db.from(t).delete().eq('espacio_id', esp);
      for(var c = 0; c < cols.length - 1; c++) q = q.eq(cols[c], v0[c]);
      var ult = cols[cols.length - 1], vals = claves.map(function(k){ var v = k.split(DB_SEP); return v[v.length - 1]; });
      q = vals.length === 1 ? q.eq(ult, vals[0]) : q.in(ult, vals);
      return q.then(function(r){
        if(r.error) throw r.error;
        claves.forEach(function(k){ if(dbUlt[t]) delete dbUlt[t][k]; });
      });
    });
  }, Promise.resolve());
}
function dbEmpujar(){
  if(!dbActiva() || !dbEst.listo) return Promise.resolve(false);
  if(dbEst.subiendo){ dbEst.otra = true; return dbEst.pSubir; }
  // mientras se está leyendo la base no se sube: se espera a que termine y ahí va
  if(dbEst.trayendo && dbEst.pTraer){ dbEst.pendiente = true; return dbEst.pTraer.then(function(){}, function(){}).then(dbEmpujar); }
  var esp = dbSes.espacio, nuevo = dbFilas(paraGuardar(sinSy())), pasos = [];
  DB_ORDEN.forEach(function(t){
    var ult = dbUlt[t] || {}, ups = [], hs = {};
    Object.keys(nuevo[t]).forEach(function(k){ var h = dbHuella(nuevo[t][k]); if(ult[k] !== h){ ups.push(nuevo[t][k]); hs[k] = h; } });
    if(ups.length) pasos.push({ t:t, ups:ups, hs:hs });
  });
  DB_ORDEN.slice().reverse().forEach(function(t){
    if(t === 'ajustes') return;
    var ult = dbUlt[t] || {}, dels = Object.keys(ult).filter(function(k){ return !(k in nuevo[t]); });
    if(dels.length) pasos.push({ t:t, dels:dels });
  });
  if(!pasos.length){ dbEst.pendiente = false; dbPintarEstado(); return Promise.resolve(false); }
  dbEst.subiendo = true; dbEst.pendiente = true; dbPintarEstado();
  dbEst.pSubir = pasos.reduce(function(p, paso){ return p.then(function(){ return dbSubirPaso(paso, esp); }); }, Promise.resolve())
    .then(function(){
      dbEst.subiendo = false; dbEst.pendiente = false; dbEst.error = ''; dbEst.reintento = 0;
      dbGuardarCache(); dbAvisar(); dbPintarEstado();
      if(dbEst.otra){ dbEst.otra = false; if(!dbEst.trayendo) return dbEmpujar(); }   // (si se está leyendo, al terminar sube solo)
      return true;
    }, function(err){
      dbEst.subiendo = false; dbEst.otra = false;
      dbEst.error = (err && (err.message || err.code)) || 'error';
      dbGuardarCache(); dbPintarEstado();
      // puede ser que no haya internet, o que otro del grupo haya cambiado algo: se vuelve a leer y se reintenta
      dbEst.reintento = Math.min((dbEst.reintento || 0) + 1, 6);
      clearTimeout(dbEst.tSubir);
      dbEst.tSubir = setTimeout(function(){ dbTraer().catch(function(){}); }, 4000 * dbEst.reintento);
      return null;
    });
  return dbEst.pSubir;
}
/* Sube ya lo que haya. Falla si no se pudo (sin conexión, por ejemplo). */
function dbEmpujarYa(){
  clearTimeout(dbEst.tSubir);
  return dbEmpujar().then(function(r){ if(r === null) throw new Error('sin_subir'); return r; });
}
function dbProgramar(ms){
  if(!dbActiva()) return;
  dbEst.pendiente = true;
  clearTimeout(dbEst.tSubir);
  dbEst.tSubir = setTimeout(function(){ dbEmpujar(); }, ms === undefined ? 900 : ms);
}

/* ---- avisarle al resto del grupo que hay algo nuevo ---- */
function dbCanal(){
  var nombre = 'espacio-' + dbSes.espacio;
  if(dbSes.canal && dbSes.canalDe === nombre) return;
  if(dbSes.canal){ try{ db.removeChannel(dbSes.canal); }catch(e){} dbSes.canal = null; }
  if(!dbActiva() || !db.channel) return;
  try{
    var c = db.channel(nombre, { config:{ broadcast:{ self:false } } });
    c.on('broadcast', { event:'cambio' }, function(){ dbTraerPronto(); });
    c.subscribe();
    dbSes.canal = c; dbSes.canalDe = nombre;
  }catch(e){}
}
function dbAvisar(){ if(dbSes.canal) try{ dbSes.canal.send({ type:'broadcast', event:'cambio', payload:{} }); }catch(e){} }

/* ---- el cartelito de estado ---- */
function dbEstadoTxt(){
  if(!dbActiva()) return ['', ''];
  if(dbEst.error && dbEst.pendiente) return ['mal', 'Sin conexión con la base: lo que cargues queda en este navegador y se sube cuando vuelva'];
  if(dbEst.subiendo || dbEst.pendiente) return ['', 'Guardando en la base…'];
  if(dbEst.trayendo && !dbEst.listo) return ['', 'Trayendo tus datos…'];
  if(!dbEst.listo) return ['mal', 'No pude leer la base: estás viendo lo que quedó en este navegador'];
  return ['ok', 'Todo guardado en la base'];
}
function dbPintarEstado(){
  var e = dbEstadoTxt();
  ['#cuentaEstado', '#fmAuto'].forEach(function(sel){
    var el = $(sel); if(!el) return;
    el.className = 'vj-auto ' + e[0];
    var s = el.querySelector('span'); if(s) s.textContent = e[1];
  });
}
// al volver a la pestaña o a tener internet: ver si hay algo nuevo, y subir lo que haya quedado
document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible' && dbActiva()) dbTraerPronto(); });
window.addEventListener('online', function(){ if(dbActiva()) dbTraerPronto(); });
