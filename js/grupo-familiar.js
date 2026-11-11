/* Cuentas Claras · js/grupo-familiar.js
   Grupo familiar: personas, gastos a medias, reparto y pendientes entre ustedes.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   grupo familiar: la app de a varios, cada uno desde su celular
   ============================================================
   Va arriba de la sincronización entre dispositivos: el grupo es el mismo
   vínculo cifrado, sólo que los dispositivos pueden ser de personas distintas.
   · `S.personas` (se sincroniza) dice quiénes son: { id, n, c:creada, t:último
     cambio, fuera? }. No se pisa al juntar: se suman las de los dos lados.
   · Cada dispositivo sabe de quién es por la lista de dispositivos
     (`S.sy.miembros[pub].p`), que viaja cifrada con las llaves de cada uno.
   · Cada movimiento, cuota, fijo, pase y aporte lleva `quien`. Lo que se cargó
     antes de armar el grupo es del que lo armó (y lo del que entra, suyo).
   · Un gasto a medias lleva `med` (entre quiénes). Cuánto le toca a cada uno
     sale de lo que ganó cada uno ese mes: si uno ganó el 60% de la plata que
     entró entre los dos, paga el 60%. Si a alguno le faltan los ingresos, va en
     partes iguales. No se guarda: se calcula, así corregir un sueldo acomoda
     los repartos solos.
   · Arriba de Resumen, Movimientos, Cuotas, Ahorros y Fijos se elige de quién
     ver los números: "Todos" es la casa entera; una persona ve lo suyo más su
     parte de lo que es a medias. */
var VER_KEY = 'plata-clara-ver';
var verQuien = (function(){ try{ return localStorage.getItem(VER_KEY) || ''; }catch(e){ return ''; } })();
var fmConf = null, _repCache = null;

function quienLimpio(q){ return (typeof q === 'string' && /^[A-Za-z0-9]{4,24}$/.test(q)) ? q : undefined; }
function medLimpio(m){
  if(!Array.isArray(m)) return undefined;
  var l = [];
  m.forEach(function(x){ x = quienLimpio(x); if(x && l.indexOf(x) < 0) l.push(x); });
  return l.length > 1 ? l.slice(0, 12) : undefined;
}
function personasLimpias(o){
  var out = [], vistos = {};
  (Array.isArray(o) ? o : []).forEach(function(p){
    if(!p || !quienLimpio(p.id) || vistos[p.id]) return;
    vistos[p.id] = 1;
    var x = { id:p.id, n:String(p.n || '?').trim().replace(/\s+/g, ' ').slice(0, 28) || '?', c:Number(p.c) || 0, t:Number(p.t) || 0 };
    if(p.fuera) x.fuera = 1;
    out.push(x);
  });
  return out.sort(function(a, b){ return (a.c - b.c) || (a.id < b.id ? -1 : 1); }).slice(0, 12);
}
/* Dos listas de personas en una: nadie se pierde, y de cada una queda su último cambio. */
function perJuntar(a, b){
  var por = {};
  personasLimpias(a).forEach(function(p){ por[p.id] = p; });
  personasLimpias(b).forEach(function(p){ var y = por[p.id]; if(!y || p.t > y.t) por[p.id] = p; });
  return personasLimpias(Object.keys(por).map(function(k){ return por[k]; }));
}
function personasTodas(){ return (S && S.personas) || []; }
function personasActivas(){ return personasTodas().filter(function(p){ return !p.fuera; }); }
function hayGrupo(){ return personasTodas().length >= 2; }
function personaPorId(id){ var r = null; personasTodas().forEach(function(p){ if(p.id === id) r = p; }); return r; }
function nombrePersona(id){ var p = personaPorId(id); return p ? p.n : '¿?'; }
function miPersona(){
  // con cuenta: lo dice la base (tabla espacio_miembros)
  if(dbActiva()) return (dbSes.persona && personaPorId(dbSes.persona)) ? dbSes.persona : '';
  var sy = S && S.sy, m = (sy && sy.miembros && sy.yo) ? sy.miembros[sy.yo.pub] : null;
  return (m && m.p && personaPorId(m.p)) ? m.p : '';
}
/* De quién es algo. Lo que no tiene nombre es del que armó el grupo. */
function quienDe(x){ return (x && x.quien) || ((personasTodas()[0] || {}).id) || ''; }
function verDe(){ return (hayGrupo() && verQuien && personaPorId(verQuien)) ? verQuien : ''; }
/* Para la plata que se movió (de qué medio salió, qué aportó cada uno) cuenta
   quién la puso, no el reparto. */
function esDeVista(x){ var v = verDe(); return !v || quienDe(x) === v; }
/* `ym` (opcional): una compra en cuotas puede ser a medias sólo desde una cuota
   (`medDesde`, v241: alguien se sumó a las que quedaban). Antes es de quien la cargó. */
function esMedias(x, ym){
  return !!(hayGrupo() && x && x.tipo !== 'ingreso' && Array.isArray(x.med) && x.med.length > 1 && !(ym && x.medDesde && ym < x.medDesde));
}

/* ---- cuánto le toca a cada uno de un gasto a medias ---- */
function ingresoPersona(pid, ym){
  var t = 0;
  // v284: sólo lo que entra como Sueldo cuenta para repartir los gastos a medias
  S.tx.forEach(function(x){ if(x.tipo === 'ingreso' && x.cat === CAT_SUELDO && mesDeTx(x) === ym && quienDe(x) === pid) t += montoPesos(x); });
  (S.fijos || []).forEach(function(f){
    if(f.tipo !== 'ingreso' || f.cat !== CAT_SUELDO || quienDe(f) !== pid) return;
    t += valorFijoMes(f, ym);
  });
  return t;
}
/* Lo que ganó en ese mes o, si todavía no cargó nada, en el último que tenga. */
function ingresoRef(pid, ym){
  for(var i = 0; i < 12; i++){ var m = ymAdd(ym, -i), v = ingresoPersona(pid, m); if(v > 0) return { v:v, ym:m }; }
  return { v:0, ym:'' };
}
/* v237: cómo se reparten los gastos a medias, para todo el grupo (`S.reparto`):
   · 'partes' (de fábrica): en partes iguales, 100% / cantidad de personas.
   · 'ingresos': según lo que ganó cada uno ese mes (si a alguno le faltan los
     ingresos, partes iguales).
   · 'mano': un porcentaje para cada uno, que suma 100. Si un gasto es entre
     algunos nada más, sus porcentajes se reparten de nuevo entre ellos.
   Es un ajuste del grupo: viaja a los demás como cualquier otro. */
/* v241: `S.famCero[persona]` es 'cero' si entró al grupo sin lo de antes, y
   'todo' cuando alguien del grupo decide que lo de antes también se suma. */
function famCeroLimpio(o){
  var r = {};
  if(o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(function(k){ if(o[k] === 'cero' || o[k] === 'todo') r[k] = o[k]; });
  return r;
}
/* En el dispositivo del que entró de cero: si le pasaron todo, lo de antes empieza a viajar. */
function famTraerRevisar(){
  var sy = S.sy, yo = miPersona();
  if(!sy || !sy.solo || !yo || !S.famCero || S.famCero[yo] !== 'todo') return false;
  delete sy.solo;
  setTimeout(function(){ toast('Lo que tenías cargado antes de sumarte ahora también está en el grupo'); }, 300);
  return true;
}
var REP_MODOS = ['partes', 'ingresos', 'mano'];
function repartoLimpio(o){
  var r = { modo:'partes', pct:{} };
  if(!o || typeof o !== 'object') return r;
  if(REP_MODOS.indexOf(o.modo) > -1) r.modo = o.modo;
  if(o.pct && typeof o.pct === 'object') Object.keys(o.pct).forEach(function(k){
    var v = Math.round(Number(o.pct[k])); if(quienLimpio(k) && v >= 0 && v <= 100) r.pct[k] = v;
  });
  return r;
}
function repModo(){ return (S && S.reparto && REP_MODOS.indexOf(S.reparto.modo) > -1) ? S.reparto.modo : 'partes'; }
/* v282: un gasto puede tener su propia forma de dividirse (`x.rep = {modo, pct}`).
   Si no la tiene, usa la del grupo, como siempre. */
function repLimpio(r){
  if(!r || typeof r !== 'object' || REP_MODOS.indexOf(r.modo) < 0) return undefined;
  var o = { modo:r.modo };
  if(r.modo === 'mano' && r.pct && typeof r.pct === 'object'){
    var pc = {}, n = 0;
    Object.keys(r.pct).forEach(function(k){ var v = Math.round(Number(r.pct[k])); if(quienLimpio(k) && v >= 0 && v <= 100){ pc[k] = v; n++; } });
    if(n) o.pct = pc;
  }
  return o;
}
var REP_NOMBRE = { partes:'partes iguales', ingresos:'por sueldo', mano:'a mano' };
var CAT_SUELDO = 'Sueldo';
/* Los porcentajes a mano de los que están hoy en el grupo, en enteros que suman
   100. Al que no tiene (recién llegado) le toca una parte igual. */
function repPctActivos(){
  var ids = personasActivas().map(function(p){ return p.id; }), pct = (S.reparto && S.reparto.pct) || {};
  if(!ids.length) return {};
  var w = ids.map(function(id){ return (id in pct) ? Number(pct[id]) || 0 : 100 / ids.length; });
  var tot = w.reduce(function(a, b){ return a + b; }, 0);
  if(!(tot > 0)) w = ids.map(function(){ return 1; }), tot = ids.length;
  return repEnteros(ids, w.map(function(x){ return x * 100 / tot; }), 100);
}
/* Redondea a enteros que sumen `total` (al que más le sobró, el punto que falta). */
function repEnteros(ids, vals, total){
  var base = vals.map(function(v){ return Math.floor(v); }), resto = total - base.reduce(function(a, b){ return a + b; }, 0);
  var orden = vals.map(function(v, i){ return { i:i, f:v - Math.floor(v) }; }).sort(function(a, b){ return b.f - a.f || a.i - b.i; });
  for(var k = 0; k < orden.length && resto > 0; k++, resto--) base[orden[k].i]++;
  var out = {}; ids.forEach(function(id, i){ out[id] = base[i]; }); return out;
}
function repartoInfo(med, ym, rep){
  var ids = (med || []).filter(function(x, i, l){ return l.indexOf(x) === i; });
  rep = repLimpio(rep);
  var modo = rep ? rep.modo : repModo();
  var propio = (rep && rep.modo === 'mano' && rep.pct) ? rep.pct : null;
  var k = modo + '|' + ym + '|' + ids.slice().sort().join(',') + (propio ? '|' + JSON.stringify(propio) : '');
  if(!_repCache) _repCache = {};
  if(_repCache[k]) return _repCache[k];
  var por = {}, refs = [], falta = [];
  if(modo === 'ingresos'){
    refs = ids.map(function(id){ return ingresoRef(id, ym); });
    falta = ids.filter(function(id, i){ return !(refs[i].v > 0); });
    var tot = refs.reduce(function(a, r){ return a + r.v; }, 0);
    ids.forEach(function(id, i){ por[id] = (falta.length || !(tot > 0)) ? 1 / ids.length : refs[i].v / tot; });
  } else if(modo === 'mano'){
    var pa = propio || repPctActivos(), w = ids.map(function(id){ return (id in pa) ? Number(pa[id]) || 0 : 100 / Math.max(1, ids.length); });
    var sw = w.reduce(function(a, b){ return a + b; }, 0);
    ids.forEach(function(id, i){ por[id] = sw > 0 ? w[i] / sw : 1 / ids.length; });
  } else {
    ids.forEach(function(id){ por[id] = 1 / ids.length; });
  }
  return (_repCache[k] = { por:por, refs:refs, ids:ids, falta:falta, modo:modo, propia:!!rep });
}
function repartoDe(med, ym, rep){ return repartoInfo(med, ym, rep).por; }
/* Qué parte de algo se ve con el filtro de arriba: todo (1), nada (0) o su parte. */
/* v289: la parte de cada uno de un gasto a medias, aunque el otro todavía no
   haya pagado la suya. Es lo que se muestra en Gastos fijos: cuánto te toca por
   mes. (pesoDe, en cambio, le carga todo al que pagó hasta que el otro le pague.) */
function pesoParte(x, ym){
  var v = verDe(); if(!v) return 1;
  if(esMedias(x, ym)){ var r = repartoDe(x.med, ym, x.rep); return r[v] || 0; }
  return quienDe(x) === v ? 1 : 0;
}
function medFalta(x, ym){
  if(!esMedias(x, ym) || !pendAplica(x, ym)) return '';
  var r = repartoInfo(x.med, ym, x.rep);
  var falta = r.ids.filter(function(d){ return d !== quienDe(x) && r.por[d] > 0 && !pendSal(x, d, ym); });
  return falta.length ? ' · falta que ' + (falta.length > 1 ? 'paguen ' : 'pague ') + listaY(falta.map(nombrePersona)) : '';
}
function pesoDe(x, ym){
  var v = verDe(); if(!v) return 1;
  if(esMedias(x, ym)){
    var r = repartoDe(x.med, ym, x.rep);
    // v284: mientras el otro no pague su parte, el gasto entero es de quien pagó
    if(pendAplica(x, ym)){
      var pag = quienDe(x);
      if(v === pag){
        var w = r[pag] || 0;
        Object.keys(r).forEach(function(d){ if(d !== pag && !pendSal(x, d, ym)) w += r[d]; });
        return w;
      }
      return pendSal(x, v, ym) ? (r[v] || 0) : 0;
    }
    return r[v] || 0;
  }
  return quienDe(x) === v ? 1 : 0;
}
/* ---- v284: gastos a medias pendientes ----
   Un gasto a medias cargado desde esta versión (`x.pend`) no se le descuenta de
   entrada al que no pagó: le queda pendiente hasta que confirma que le pagó al
   otro. Lo pagado queda en `x.sal[clave] = { t, de, a }`: cuándo, de qué medio
   salió la plata del que debía y a qué medio le entró al que había pagado. La
   clave es la persona en un gasto suelto, y "persona|mes" en una cuota o un fijo.
   Los gastos a medias de antes siguen como siempre: repartidos de una. */
function pendTipo(x){ return Array.isArray(x && x.precios) ? 'f' : (x && x.total !== undefined && x.n !== undefined) ? 'q' : 't'; }
function pendAplica(x, ym){ return !!(x && x.pend && esMedias(x, ym) && (!x.pendDesde || !ym || ym >= x.pendDesde)); }
function pendClave(x, d, ym){ return pendTipo(x) === 't' ? d : d + '|' + ym; }
function pendSal(x, d, ym){ return !!(x && x.sal && x.sal[pendClave(x, d, ym)]); }
function pendMonto(x, ym){
  var t = pendTipo(x);
  return t === 't' ? montoPesos(x) : t === 'q' ? cuotaMonto(x) : montoFijoPesos(x, ym);
}
function salLimpio(o){
  if(!o || typeof o !== 'object' || Array.isArray(o)) return undefined;
  var r = {}, n = 0;
  Object.keys(o).forEach(function(k){
    var v = o[k];
    if(!/^[A-Za-z0-9]{4,24}(\|\d{4}-\d{2})?$/.test(k) || !v || typeof v !== 'object') return;
    r[k] = { t:Number(v.t) || 0, de:String(v.de || '').slice(0, 28), a:String(v.a || '').slice(0, 28) }; n++;
  });
  return n ? r : undefined;
}
/* Lo que falta pagar, de todo el grupo, en lo que estoy yo (como el que debe o
   el que pagó). Sólo lo que ya pasó: una cuota o un fijo, desde el día que vence. */
function pendLista(){
  var yo = miPersona(); if(!hayGrupo() || !yo) return [];
  var hoy = today(), ymH = ymNow(), out = [];
  function agregar(x, ym, fecha, nombre, extra){
    if(!pendAplica(x, ym)) return;
    var monto = pendMonto(x, ym); if(!(monto > 0)) return;
    var r = repartoDe(x.med, ym, x.rep), pag = quienDe(x);
    Object.keys(r).forEach(function(d){
      if(d === pag || !(r[d] > 0) || pendSal(x, d, ym)) return;
      if(d !== yo && pag !== yo) return;
      out.push({ id:pendTipo(x) + ':' + x.id + ':' + d + ':' + ym, x:x, ym:ym, fecha:fecha, deudor:d, pagador:pag,
                 monto:Math.round(monto * r[d] * 100) / 100, pct:r[d], nombre:nombre, extra:extra || '' });
    });
  }
  S.tx.forEach(function(t){
    if(t.pend && t.tipo === 'gasto' && t.fecha && t.fecha <= hoy) agregar(t, ymOf(t.fecha), t.fecha, t.nota || t.cat || 'Gasto');
  });
  S.planes.forEach(function(p){
    if(!p.pend) return;
    var n = Math.max(1, Number(p.n) || 1);
    for(var i = 0; i < n; i++){
      var ymC = ymAdd(p.desde, i); if(ymC > ymH) break;
      var fe = fechaCuota(p, ymC);
      if(fe <= hoy) agregar(p, ymC, fe, p.desc || 'Compra en cuotas', 'cuota ' + (i + 1) + ' de ' + n);
    }
  });
  (S.fijos || []).forEach(function(f){
    if(!f.pend || f.tipo === 'ingreso') return;
    var ymF = f.pendDesde && f.pendDesde > f.desde ? f.pendDesde : f.desde;
    for(var k = 0; k < 240 && ymF <= ymH; k++){
      ocurrenciasFijo(f, ymF).forEach(function(oc){
        if(!oc.falta && oc.fecha <= hoy) agregar(f, ymF, oc.fecha, f.nombre || 'Gasto fijo', 'fijo');
      });
      ymF = ymAdd(ymF, 1);
    }
  });
  return out.sort(function(a, b){ return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0; });
}
/* Lo que ya se pagó entre ustedes: de qué medio salió y a cuál entró. */
function liquidaciones(){
  var out = [];
  function ver(x){
    if(!x || !x.pend || !x.sal || !Array.isArray(x.med)) return;
    Object.keys(x.sal).forEach(function(k){
      var pr = k.split('|'), d = pr[0], ym = pr[1] || (x.fecha ? ymOf(x.fecha) : '');
      if(!ym || !pendAplica(x, ym)) return;
      var r = repartoDe(x.med, ym, x.rep), monto = pendMonto(x, ym) * (r[d] || 0), sv = x.sal[k];
      if(!(monto > 0)) return;
      out.push({ fecha:sv.t ? fechaISO(new Date(sv.t)) : (x.fecha || ym + '-01'), de:sv.de, a:sv.a, monto:Math.round(monto * 100) / 100, deudor:d, pagador:quienDe(x) });
    });
  }
  S.tx.forEach(ver); S.planes.forEach(ver); (S.fijos || []).forEach(ver);
  return out;
}

/* ---- v284: el bloque "Pendientes del grupo" (arriba de Movimientos) ---- */
var ICO_RELOJ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
var ICO_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
var pendAbierto = false, pendConf = '';
var PEND_MEDIO = 'plata-clara-pendmedio';
/* Por cada persona con la que tengo algo pendiente: lo que le debo y lo que me debe. */
function pendPorPersona(){
  var yo = miPersona(), por = {}, orden = [];
  pendLista().forEach(function(e){
    var o = e.deudor === yo ? e.pagador : e.deudor;
    if(!por[o]){ por[o] = { otro:o, debo:[], meDebe:[], tDebo:0, tMeDebe:0 }; orden.push(o); }
    if(e.deudor === yo){ por[o].debo.push(e); por[o].tDebo += e.monto; } else { por[o].meDebe.push(e); por[o].tMeDebe += e.monto; }
  });
  return orden.map(function(o){ var g = por[o]; g.neto = Math.round((g.tDebo - g.tMeDebe) * 100) / 100; return g; });
}
function pendResumen(){
  var gs = pendPorPersona(); if(!gs.length) return null;
  var debo = 0, meDeben = 0, n = 0;
  gs.forEach(function(g){ if(g.neto > 0) debo += g.neto; else meDeben += -g.neto; n += g.debo.length + g.meDebe.length; });
  var sub;
  if(gs.length === 1){
    var g = gs[0], nom = nombrePersona(g.otro);
    sub = g.neto > 0 ? 'Le debés a ' + nom : g.neto < 0 ? nom + ' te debe' : 'Con ' + nom + ' están a mano';
  } else sub = (debo > 0 ? 'Debés ' + money(debo) : '') + (debo > 0 && meDeben > 0 ? ' · ' : '') + (meDeben > 0 ? 'te deben ' + money(meDeben) : '');
  var neto = debo - meDeben;
  return { grupos:gs, n:n, sub:sub, total:Math.abs(gs.length === 1 ? gs[0].neto : neto), afavor:(gs.length === 1 ? gs[0].neto : neto) < 0 };
}
function pendFinDeMes(){ var d = new Date(); return finDeMes(ymNow()) - d.getDate() <= 1; }
function pendMedioDef(sug){
  var l = medios(), m = '';
  try{ m = localStorage.getItem(PEND_MEDIO) || ''; }catch(x){}
  if(m && l.indexOf(m) > -1) return m;
  if(sug && l.indexOf(sug) > -1) return sug;
  return l[0] || '';
}
function pendSelect(id, sug){
  var def = pendMedioDef(sug);
  return '<select id="' + id + '" aria-label="Medio de pago">' + medios().map(function(m){ return '<option' + (m === def ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select>';
}
function pendItemHtml(e, yo){
  var mio = e.pagador === yo, nom = nombrePersona(mio ? e.deudor : e.pagador);
  var det = fechaLabel(e.fecha) + (e.extra ? ' · ' + e.extra : '') + ' · ' + (mio ? 'pagaste vos · su parte ' : 'pagó ' + nom + ' · tu parte ') + pctTxt(e.pct)
    + (e.ym < ymNow() ? ' · de ' + ymLabel(e.ym, true) : '');
  var conf = pendConf === e.id, btn = conf ? '' : (mio
    ? '<button type="button" class="btn ghost sm" data-pendcobre="' + esc(e.id) + '">Ya me pagó</button>'
    : '<button type="button" class="btn sm" data-pendpagar="' + esc(e.id) + '">Lo pagué</button>');
  var html = '<div class="pi' + (mio ? ' mio' : '') + '"><span class="reloj">' + ICO_RELOJ + '</span><span><b>' + esc(e.nombre) + '</b><small>' + esc(det) + '</small></span>'
    + '<span class="der"><span>' + esc(money(e.monto)) + '</span>' + btn + '</span></div>';
  if(conf){
    var sel = $('#pendSel') ? $('#pendSel').value : '';
    html += '<div class="pend-conf">' + (mio ? '<b>¿Dónde te entró?</b>' : '<b>¿Con qué le pagaste?</b>')
      + '<div class="rowflex">' + pendSelect('pendSel', mio ? e.x.medio : '') + '<button type="button" class="btn sm" data-pendok="' + esc(e.id) + '">Confirmar</button>'
      + '<button type="button" class="linkbtn" data-pendno>Cancelar</button></div>'
      + '<div style="margin-top:8px" data-pendexpl>' + pendExpl(e, mio, sel || pendMedioDef(mio ? e.x.medio : '')) + '</div></div>';
  }
  return html;
}
function pendExpl(e, mio, m){
  return mio
    ? 'Se suman ' + esc(money(e.monto)) + ' a tu ' + esc(m) + ' y ' + esc(nombrePersona(e.deudor)) + ' lo ve como pagado.'
    : 'Se descuentan ' + esc(money(e.monto)) + ' de tu ' + esc(m) + (e.x.medio ? ' y le entran a ' + esc(nombrePersona(e.pagador)) + ' en ' + esc(e.x.medio) + ', donde pagó' : ' y le entran a ' + esc(nombrePersona(e.pagador))) + '. Recién ahí cuenta como gasto tuyo.';
}
function renderPend(){
  var box = $('#pendBox'); if(!box) return;
  var r = pendResumen();
  if(!r){ box.hidden = true; box.innerHTML = ''; pendConf = ''; return; }
  var yo = miPersona(), fin = pendFinDeMes();
  var html = '<div class="pend' + (pendAbierto ? ' abierto' : '') + (r.afavor ? ' afavor' : '') + '">'
    + '<button type="button" class="pend-cab" data-pendcab aria-expanded="' + (pendAbierto ? 'true' : 'false') + '"><span class="reloj">' + ICO_RELOJ + '</span>'
    + '<span><b>Pendientes del grupo</b><small>' + esc(fin ? 'Termina el mes: saldá lo pendiente' : r.sub + ' · ' + r.n + (r.n === 1 ? ' gasto a medias' : ' gastos a medias')) + '</small></span>'
    + '<span class="tot">' + esc(money(r.total)) + '<small>' + (pendAbierto ? 'cerrar' : 'ver') + ' ' + ICO_CHEV + '</small></span></button>';
  if(pendAbierto){
    html += '<div class="pend-cuerpo">';
    r.grupos.forEach(function(g){
      var nom = esc(nombrePersona(g.otro));
      if(g.debo.length) html += '<div class="sub-t">Le debés a ' + nom + ' · ' + esc(money(g.tDebo)) + '</div>' + g.debo.map(function(e){ return pendItemHtml(e, yo); }).join('');
      if(g.meDebe.length) html += '<div class="sub-t">' + nom + ' te debe · ' + esc(money(g.tMeDebe)) + '</div>' + g.meDebe.map(function(e){ return pendItemHtml(e, yo); }).join('');
      var cid = 'todo:' + g.otro, n = g.debo.length + g.meDebe.length;
      html += '<div class="pend-cierre"><h4>Para quedar a mano' + (r.grupos.length > 1 ? ' con ' + nom : '') + '</h4>'
        + (g.neto !== 0
            ? '<div class="pend-flecha">' + (g.neto > 0 ? esc(nombrePersona(yo)) + ' → ' + nom : nom + ' → ' + esc(nombrePersona(yo))) + '<b>' + esc(money(Math.abs(g.neto))) + '</b></div>'
            : '<div class="pend-flecha">Están a mano<b>' + esc(money(0)) + '</b></div>')
        + '<p>' + (g.debo.length && g.meDebe.length ? 'Lo que le debés menos lo que te debe. ' : '') + 'Salda ' + (n === 1 ? 'el gasto' : 'los ' + n + ' gastos') + ' de una vez. Si no lo saldan antes, el último día del mes te lo recuerdo.</p>';
      if(pendConf === cid){
        var sel = $('#pendSel') ? $('#pendSel').value : pendMedioDef('');
        html += '<div class="pend-conf">' + (g.neto > 0 ? '<b>¿Con qué le pagás?</b>' : g.neto < 0 ? '<b>¿Dónde te entra?</b>' : '<b>¿Saldar todo?</b>')
          + '<div class="rowflex">' + (g.neto !== 0 ? pendSelect('pendSel', '') : '') + '<button type="button" class="btn sm" data-pendtodook="' + esc(g.otro) + '">Confirmar</button>'
          + '<button type="button" class="linkbtn" data-pendno>Cancelar</button></div>'
          + '<div style="margin-top:8px">' + (g.neto > 0 ? 'Se descuentan ' + esc(money(g.neto)) + ' de tu ' + esc(sel) + ' y le entran a ' + nom + '.'
              : g.neto < 0 ? 'Se suman ' + esc(money(-g.neto)) + ' a tu ' + esc(sel) + '.' : 'Se compensan entre ustedes: no se mueve plata.')
          + ' Quedan saldados ' + (n === 1 ? 'el gasto' : 'los ' + n + ' gastos') + '.</div></div>';
      } else html += '<button type="button" class="btn" style="width:100%;min-height:40px" data-pendtodo="' + esc(g.otro) + '">Saldar todo</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  box.innerHTML = html + '</div>';
  box.hidden = false;
  if(fin){
    var hoy = today(), ya = '';
    try{ ya = localStorage.getItem('plata-clara-pendaviso') || ''; }catch(x){}
    if(ya !== hoy){
      try{ localStorage.setItem('plata-clara-pendaviso', hoy); }catch(x){}
      setTimeout(function(){ toast('Termina el mes y tenés pendientes con el grupo', { texto:'Ver', ir:'mov' }, 'info'); }, 800);
    }
  }
}
/* el renglón de "Últimos movimientos" */
function rowPendResumen(){
  var r = pendResumen(); if(!r) return '';
  return '<div class="row pendrow" data-pendir role="button" tabindex="0"><span class="mark pendm">' + ICO_RELOJ + '</span><span class="t"><b>Pendientes del grupo</b><small>'
    + esc(r.sub + ' · ' + r.n + (r.n === 1 ? ' gasto' : ' gastos')) + '</small></span><span class="amt" style="color:var(--' + (r.afavor ? 'in' : 'warn') + ')">' + esc(money(r.total)) + '</span></div>';
}
function pendBuscar(id){ var r = null; pendLista().forEach(function(e){ if(e.id === id) r = e; }); return r; }
function pendMarcar(e, de, a){
  var x = e.x;
  x.sal = Object.assign({}, x.sal || {});
  x.sal[pendClave(x, e.deudor, e.ym)] = { t:Date.now(), de:de, a:a };
}
function pendGuardar(m){ try{ if(m) localStorage.setItem(PEND_MEDIO, m); }catch(x){} }
document.addEventListener('click', function(e){
  if(!e.target.closest) return;
  var t;
  if(e.target.closest('[data-pendcab]')){ pendAbierto = !pendAbierto; pendConf = ''; renderPend(); return; }
  if(e.target.closest('[data-pendir]')){ pendAbierto = true; pendConf = ''; go('mov'); setTimeout(function(){ var b = $('#pendBox'); if(b) b.scrollIntoView({ block:'start', behavior:'smooth' }); }, 60); return; }
  if((t = e.target.closest('[data-pendpagar], [data-pendcobre]'))){ pendConf = t.getAttribute('data-pendpagar') || t.getAttribute('data-pendcobre'); renderPend(); return; }
  if((t = e.target.closest('[data-pendtodo]'))){ pendConf = 'todo:' + t.getAttribute('data-pendtodo'); renderPend(); return; }
  if(e.target.closest('[data-pendno]')){ pendConf = ''; renderPend(); return; }
  if((t = e.target.closest('[data-pendok]'))){
    var en = pendBuscar(t.getAttribute('data-pendok')); if(!en){ pendConf = ''; renderPend(); return; }
    var m = ($('#pendSel') || {}).value || '', yo = miPersona();
    if(en.pagador === yo){ pendMarcar(en, m, m); }
    else { pendMarcar(en, m, en.x.medio || m); pendGuardar(m); }
    pendConf = ''; save(); render();
    toast(en.pagador === yo ? 'Listo: ' + nombrePersona(en.deudor) + ' ya te pagó ' + money(en.monto) : 'Listo: le pagaste ' + money(en.monto) + ' a ' + nombrePersona(en.pagador), null, 'ok');
    return;
  }
  if((t = e.target.closest('[data-pendtodook]'))){
    var otro = t.getAttribute('data-pendtodook'), g = null;
    pendPorPersona().forEach(function(x){ if(x.otro === otro) g = x; });
    if(!g){ pendConf = ''; renderPend(); return; }
    var sel = ($('#pendSel') || {}).value || pendMedioDef('');
    // de qué medio sale lo del otro: el de un gasto que pagó él (si no hay, el mismo)
    var suyo = (g.debo[0] && g.debo[0].x.medio) || sel;
    g.debo.forEach(function(en){ pendMarcar(en, sel, en.x.medio || suyo); });
    g.meDebe.forEach(function(en){ pendMarcar(en, suyo, sel); });
    if(g.neto > 0) pendGuardar(sel);
    pendConf = ''; save(); render();
    toast(g.neto > 0 ? 'Listo: le pagaste ' + money(g.neto) + ' a ' + nombrePersona(otro) + ' y quedaron a mano'
        : g.neto < 0 ? 'Listo: ' + nombrePersona(otro) + ' te pagó ' + money(-g.neto) + ' y quedaron a mano' : 'Listo: quedaron a mano', null, 'ok');
    return;
  }
});
document.addEventListener('change', function(e){
  if(e.target && e.target.id === 'pendSel' && pendConf){
    var ex = document.querySelector('[data-pendexpl]');
    if(ex){ var en = pendBuscar(pendConf); if(en) ex.innerHTML = pendExpl(en, en.pagador === miPersona(), e.target.value); }
    else renderPend();
  }
});
document.addEventListener('keydown', function(e){
  if((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-pendir]')){ e.preventDefault(); e.target.click(); }
});
/* Los movimientos vistos por una persona: los suyos enteros y, de los gastos a
   medias, su parte. Con "Todos" no cambia nada. */
function conPeso(l){
  if(!verDe()) return l;
  var out = [];
  l.forEach(function(t){
    var w = pesoDe(t, ymOf(t.fecha));
    if(!(w > 0)) return;
    out.push(w === 1 ? t : Object.assign({}, t, { monto:Math.round((Number(t.monto) || 0) * w * 100) / 100, _total:t.monto }));
  });
  return out;
}
function indiceTx(){ var o = {}; S.tx.forEach(function(t, i){ o[t.id] = i; }); return o; }
function pctTxt(f){ return Math.round((f || 0) * 100) + '%'; }
function quienTxt(x){ return hayGrupo() ? ' · ' + nombrePersona(quienDe(x)) : ''; }
var ICO_UNO = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="5" r="2.6"/><path d="M3 14c0-2.9 2.2-4.8 5-4.8s5 1.9 5 4.8"/></svg>';
var ICO_VARIOS = '<svg viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="5" cy="5.6" r="2"/><path d="M1 13.6c0-2.2 1.7-3.6 3.6-3.6"/><circle cx="17" cy="5.6" r="2"/><path d="M21 13.6c0-2.2-1.7-3.6-3.6-3.6"/><circle cx="11" cy="4.8" r="2.5"/><path d="M6.4 14.2c0-2.8 2-4.5 4.6-4.5s4.6 1.7 4.6 4.5"/></svg>';
/* v241: delante del nombre, en un grupo: una personita si es de uno, varias si es a medias. */
function icoQ(x, ym){
  if(!hayGrupo()) return '';
  return esMedias(x, ym)
    ? '<i class="qico med" role="img" aria-label="A medias" title="A medias">' + ICO_VARIOS + '</i>'
    : '<i class="qico" role="img" aria-label="De ' + esc(nombrePersona(quienDe(x))) + '" title="De ' + esc(nombrePersona(quienDe(x))) + '">' + ICO_UNO + '</i>';
}
function medTxt(x, ym, total){
  if(esMedias(x) && !esMedias(x, ym)) return ' · a medias desde ' + ymLabel(x.medDesde, true);
  if(!esMedias(x, ym)) return '';
  var r = repartoInfo(x.med, ym, x.rep), v = verDe();
  var faltaTxt = '';
  if(pendAplica(x, ym)){
    var falta = r.ids.filter(function(d){ return d !== quienDe(x) && r.por[d] > 0 && !pendSal(x, d, ym); });
    if(falta.length) faltaTxt = ' · falta que ' + (falta.length > 1 ? 'paguen ' : 'pague ') + listaY(falta.map(nombrePersona));
  }
  if(v) return ' · a medias: ' + (v === miPersona() ? 'te toca' : 'le toca') + ' el ' + pctTxt(r.por[v]) + ' de ' + money(total) + faltaTxt;
  return ' · a medias: ' + r.ids.map(function(id){ return nombrePersona(id) + ' ' + pctTxt(r.por[id]); }).join(', ') + faltaTxt;
}
function textoReparto(med, ym, total, rep){
  var r = repartoInfo(med, ym, rep);
  return r.ids.map(function(id){ return nombrePersona(id) + ' ' + money(total * r.por[id]) + ' (' + pctTxt(r.por[id]) + ')'; }).join(' · ');
}
/* Lo que no tiene dueño pasa a ser de la persona de este dispositivo. */
function etiquetar(){
  var yo = miPersona(); if(!yo) return false;
  var n = 0;
  function t(x){ if(x && !x.quien){ x.quien = yo; n++; } }
  S.tx.forEach(t); S.planes.forEach(t); (S.fijos || []).forEach(t); (S.pases || []).forEach(t); (S.hx || []).forEach(t);
  S.metas.forEach(function(m){ (m.aportes || []).forEach(t); });
  return n > 0;
}

/* ---- el filtro de arriba ---- */
function pintarVerQuien(){
  var el = $('#verQuienBar'); if(!el) return;
  var ok = hayGrupo() && ['resumen', 'mov', 'cuotas', 'ahorro', 'fijos'].indexOf(vista) > -1;
  el.hidden = !ok;
  if(!ok){ el.innerHTML = ''; return; }
  var v = verDe(), yo = miPersona();
  var html = '<div class="seg" role="group" aria-label="De quién ver los números">'
    + '<button type="button" data-ver="" aria-pressed="' + (v ? 'false' : 'true') + '">Todos</button>'
    + personasTodas().filter(function(p){ return !p.fuera || p.id === v; }).map(function(p){
        return '<button type="button" data-ver="' + esc(p.id) + '" aria-pressed="' + (v === p.id ? 'true' : 'false') + '">' + esc(p.n) + '</button>';
      }).join('') + '</div>';
  if(v) html += '<p class="note">' + (v === yo ? 'Lo tuyo' : 'Lo de ' + esc(nombrePersona(v)))
    + ': ingresos y gastos propios, más su parte de los gastos a medias. Los intereses de las cuentas están en "Todos".</p>';
  el.innerHTML = html;
}

/* ---- "Quién" y "A medias" en los formularios ---- */
var QB = { m:'#mQuienBox', q:'#qQuienBox', f:'#fQuienBox' };
function quienBoxHtml(pref){
  var ps = personasActivas();
  return '<div class="qb" data-qb="' + pref + '">'
    + '<div class="field"><label class="lab" for="' + pref + 'Quien">Quién</label><select id="' + pref + 'Quien">'
    + ps.map(function(p){ return '<option value="' + esc(p.id) + '">' + esc(p.n) + '</option>'; }).join('') + '</select></div>'
    + '<div class="qb-aviso" data-qbaviso="' + pref + '" role="note" hidden></div>'
    + '<div class="qb-med"><button type="button" class="swi" role="switch" aria-checked="false" data-medsw="' + pref + '">'
    + '<span class="swi-t"></span><span>A medias</span></button>'
    + '<div class="chips" data-medchips="' + pref + '" role="group" aria-label="Entre quiénes" hidden>'
    + ps.map(function(p){ return '<button type="button" data-medp="' + esc(p.id) + '" aria-pressed="true">' + esc(p.n) + '</button>'; }).join('')
    + '</div>'
    + '<div class="qb-rep" data-repbox="' + pref + '" hidden><span class="lab">Cómo se divide</span>'
    + '<div class="seg" role="group" aria-label="Cómo se divide este gasto">'
    + REP_MODOS.map(function(m){ return '<button type="button" data-repm="' + m + '" aria-pressed="false">' + ({ partes:'Partes iguales', ingresos:'Por sueldo', mano:'A mano' })[m] + '</button>'; }).join('')
    + '</div><small class="qb-def" data-repdef></small><div class="qb-mano" data-repmano hidden></div></div>'
    + '<small class="pista" data-medpista="' + pref + '" hidden></small></div></div>';
}
/* v282: la forma de dividir que muestra el formulario. Mientras no la toques,
   es la del grupo (y el gasto no guarda nada propio: si el grupo la cambia, lo
   sigue). Si la cambiás, queda guardada en ese gasto. */
function repDelBox(box){
  var modo = box.getAttribute('data-repmodo');
  if(REP_MODOS.indexOf(modo) < 0) modo = repModo();
  var propia = box.getAttribute('data-reppropia') === '1';
  var pct = box._repPct || null;
  return { modo:modo, propia:propia, pct:pct };
}
function repPctDe(ids, pct){
  // los porcentajes para estas personas: los propios, o los del grupo repartidos entre ellas
  var base = pct || repPctActivos(), w = ids.map(function(id){ return (id in base) ? Number(base[id]) || 0 : 100 / ids.length; });
  var tot = w.reduce(function(a, b){ return a + b; }, 0);
  if(pct) return repEnteros(ids, w, w.reduce(function(a, b){ return a + b; }, 0) || 100);
  if(!(tot > 0)) w = ids.map(function(){ return 1; }), tot = ids.length;
  return repEnteros(ids, w.map(function(x){ return x * 100 / tot; }), 100);
}
function pintarRep(pref){
  var box = $(QB[pref]); if(!box) return;
  var rb = box.querySelector('[data-repbox]'); if(!rb) return;
  var sw = box.querySelector('[data-medsw]'), on = !!(sw && sw.getAttribute('aria-checked') === 'true');
  var ids = $$('[data-medp][aria-pressed="true"]', box).map(function(b){ return b.getAttribute('data-medp'); });
  rb.hidden = !on || ids.length < 2; if(rb.hidden) return;
  var r = repDelBox(box), grupo = repModo();
  $$('[data-repm]', rb).forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-repm') === r.modo ? 'true' : 'false'); });
  var def = rb.querySelector('[data-repdef]');
  def.innerHTML = r.propia
    ? 'Sólo para este gasto.<button type="button" class="linkbtn" data-repgrupo="' + pref + '">Volver a la del grupo (' + REP_NOMBRE[grupo] + ')</button>'
    : 'Viene elegida la del grupo: <b>' + REP_NOMBRE[grupo] + '</b>.';
  var mano = rb.querySelector('[data-repmano]');
  mano.hidden = (r.modo !== 'mano');
  if(r.modo !== 'mano') return;
  var clave = ids.join(',');
  var pc = repPctDe(ids, r.pct);
  if(mano.getAttribute('data-ids') !== clave){
    mano.setAttribute('data-ids', clave);
    mano.innerHTML = ids.map(function(id){
      return '<div class="fila"><span>' + esc(nombrePersona(id)) + '</span><span class="pctin"><input type="text" inputmode="numeric" maxlength="3" data-reppct="' + esc(id)
        + '" value="' + (pc[id] || 0) + '" aria-label="Porcentaje de ' + esc(nombrePersona(id)) + '"><i>%</i></span><span class="plata" data-repplata="' + esc(id) + '"></span></div>';
    }).join('') + '<small class="qb-suma" data-repsuma></small>';
  }
  var d = formMedDatos(pref), suma = 0;
  ids.forEach(function(id){
    var inp = mano.querySelector('[data-reppct="' + id + '"]'), v = Math.max(0, Math.min(100, parseInt(inp && inp.value, 10) || 0));
    suma += v;
    var pl = mano.querySelector('[data-repplata="' + id + '"]'); if(pl) pl.textContent = d.monto > 0 ? money(d.monto * v / 100) : '';
  });
  var sm = mano.querySelector('[data-repsuma]');
  sm.classList.toggle('mal', suma !== 100);
  sm.textContent = suma === 100 ? '✓ Suma 100%' : 'Suman ' + suma + '%: al guardar se reparte en proporción.';
}
/* lo que se escribió en los porcentajes a mano */
function repLeerMano(box){
  var o = {}, n = 0;
  $$('[data-reppct]', box).forEach(function(i){ o[i.getAttribute('data-reppct')] = Math.max(0, Math.min(100, parseInt(i.value, 10) || 0)); n++; });
  return n ? o : null;
}
/* v282: el aviso de "Quién" cuando cargás algo de otra persona */
var ICO_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/></svg>';
function pintarAvisoQuien(pref){
  var box = $(QB[pref]); if(!box) return;
  var av = box.querySelector('[data-qbaviso]'); if(!av) return;
  var sel = $('#' + pref + 'Quien'), q = sel && sel.value, yo = miPersona();
  if(!q || !yo || q === yo){ av.hidden = true; av.innerHTML = ''; return; }
  var n = esc(nombrePersona(q)), med = ($('#' + pref + 'Medio') || {}).value || '';
  var ing = (pref === 'm' && cargaTab === 'ingreso') || (pref === 'f' && fijoTab === 'ingreso');
  var que = pref === 'q' ? 'una <b>compra en cuotas de ' + n + '</b>: cada cuota se descuenta de su balance'
    : pref === 'f' ? (ing ? 'un <b>ingreso fijo de ' + n + '</b>: se suma a su balance' : 'un <b>gasto fijo de ' + n + '</b>: se descuenta de su balance')
    : ing ? 'un <b>ingreso de ' + n + '</b>: se suma a su balance' : 'un <b>gasto de ' + n + '</b>: se descuenta de su balance';
  av.innerHTML = ICO_INFO + '<span>Lo cargás vos, pero es ' + que
    + (med ? (ing ? ' y a su <b>' : ' y de su <b>') + esc(med) + '</b> (si no lo tenía, se le agrega)' : '')
    + '. ' + n + ' lo puede corregir.</span>';
  av.hidden = false;
}
function pintarQuienForms(){
  var firma = personasActivas().length >= 2 ? personasActivas().map(function(p){ return p.id + ':' + p.n; }).join('|') : '';
  Object.keys(QB).forEach(function(pref){
    var box = $(QB[pref]); if(!box) return;
    if(!firma){ box.hidden = true; box.innerHTML = ''; box.removeAttribute('data-firma'); return; }
    box.hidden = false;
    if(box.getAttribute('data-firma') === firma) return;
    var antes = box.firstChild ? grupoDelForm(pref, true) : null;
    box.innerHTML = quienBoxHtml(pref); box.setAttribute('data-firma', firma);
    ponerQuien(pref, antes && antes.quien, antes && antes.med, antes && antes.rep);
  });
  var mqb = $('#mQuienBox .qb-med'); if(mqb) mqb.hidden = (cargaTab !== 'gasto');
  var fqb = $('#fQuienBox .qb-med'); if(fqb) fqb.hidden = (fijoTab === 'ingreso');
  Object.keys(QB).forEach(function(pref){ if($(QB[pref]) && $(QB[pref]).firstChild) pintarAvisoQuien(pref); });
}
function ponerQuien(pref, quien, med, rp){
  var box = $(QB[pref]); if(!box || !box.firstChild) return;
  rp = repLimpio(rp);
  box.setAttribute('data-repmodo', rp ? rp.modo : repModo());
  box.setAttribute('data-reppropia', rp ? '1' : '');
  box._repPct = (rp && rp.pct) ? rp.pct : null;
  var mn = box.querySelector('[data-repmano]'); if(mn) mn.removeAttribute('data-ids');
  var sel = $('#' + pref + 'Quien');
  if(sel){ sel.value = quien || miPersona() || ''; if(!sel.value && sel.options.length) sel.selectedIndex = 0; }
  var on = Array.isArray(med) && med.length > 1;
  var sw = box.querySelector('[data-medsw]'); if(sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
  var ch = box.querySelector('[data-medchips]');
  if(ch){
    ch.hidden = !on;
    $$('[data-medp]', ch).forEach(function(b){ b.setAttribute('aria-pressed', (!on || med.indexOf(b.getAttribute('data-medp')) > -1) ? 'true' : 'false'); });
  }
  pintarPistaMed(pref);
}
/* Lo que dicen "Quién" y "A medias" en un formulario: { quien, med }. */
function grupoDelForm(pref, conMed){
  if(personasActivas().length < 2) return {};
  var box = $(QB[pref]); if(!box || !box.firstChild) return {};
  var sel = $('#' + pref + 'Quien'), out = { quien:quienLimpio(sel && sel.value) || miPersona() || undefined };
  var sw = box.querySelector('[data-medsw]');
  if(conMed && sw && sw.getAttribute('aria-checked') === 'true'){
    var l = $$('[data-medp][aria-pressed="true"]', box).map(function(b){ return b.getAttribute('data-medp'); });
    if(l.length > 1){
      out.med = l;
      var r = repDelBox(box);
      if(r.propia){
        out.rep = { modo:r.modo };
        if(r.modo === 'mano'){ var pc = repLeerMano(box); if(pc) out.rep.pct = pc; }
      }
    }
  }
  return out;
}
function formMedDatos(pref){
  if(pref === 'm') return { monto:parseMoney($('#mMonto').value) * (monMov === 'USD' ? (cotDolar() || 0) : 1), ym:ymOf($('#mFecha').value || defaultFecha()) };
  if(pref === 'q'){
    var n = Math.max(1, parseInt($('#qN').value, 10) || 1);
    return { monto:parseMoney($('#qTotal').value) / n, ym:$('#qDesde').value || mes, cuota:true };
  }
  var ymFijo = (fijoTab === 'ingreso') ? ($('#fDesde').value || mes) : ymOf($('#fFecha').value || defaultFecha());
  return { monto:parseMoney($('#fMonto').value) * (monFijo === 'USD' ? (cotDolar() || 0) : 1), ym:ymFijo, fijo:true };
}
function pintarPistaMed(pref){
  var box = $(QB[pref]); if(!box) return;
  var pi = box.querySelector('[data-medpista]'); if(!pi) return;
  var sw = box.querySelector('[data-medsw]'), on = !!(sw && sw.getAttribute('aria-checked') === 'true');
  pintarAvisoQuien(pref);
  pintarRep(pref);
  pi.hidden = !on; if(!on) return;
  var g = grupoDelForm(pref, true);
  if(!g.med){ pi.textContent = 'Elegí al menos dos personas.'; return; }
  var d = formMedDatos(pref), r = repartoInfo(g.med, d.ym, g.rep);
  var partes = r.ids.map(function(id){
    return nombrePersona(id) + ' ' + pctTxt(r.por[id]) + (d.monto > 0 ? ' (' + money(d.monto * r.por[id]) + (d.cuota ? ' por cuota' : '') + ')' : '');
  }).join(' · ');
  pi.textContent = (r.modo === 'partes' ? 'En partes iguales: '
      : r.modo === 'mano' ? (r.propia ? 'A mano: ' : 'Con los porcentajes del grupo: ')
      : r.falta.length
      ? 'Todavía no hay sueldo cargado de ' + listaY(r.falta.map(nombrePersona)) + ', así que va en partes iguales: '
      : 'Según el sueldo de cada uno' + (d.fijo || d.cuota ? ', mes a mes' : '') + ': ')
    + partes + '.';
}

/* ---- la pantalla del grupo ---- */
function repartoMes(ym){
  var por = {}, comp = 0, nComp = 0;
  personasActivas().forEach(function(p){ por[p.id] = { ing:ingresoRef(p.id, ym), propio:0, parte:0 }; });
  function gasto(x, monto){
    if(!(monto > 0)) return;
    if(esMedias(x, ym)){
      comp += monto; nComp++;
      var r = repartoDe(x.med, ym, x.rep);
      Object.keys(r).forEach(function(id){ if(por[id]) por[id].parte += monto * r[id]; });
    } else { var q = quienDe(x); if(por[q]) por[q].propio += monto; }
  }
  S.tx.forEach(function(t){ if(t.tipo === 'gasto' && ymOf(t.fecha) === ym) gasto(t, montoPesos(t)); });
  S.planes.forEach(function(p){ var i = ymDiff(p.desde, ym); if(i >= 0 && i < (Number(p.n) || 0)) gasto(p, cuotaMonto(p)); });
  (S.fijos || []).forEach(function(f){
    if((f.tipo || 'gasto') === 'gasto' && ym >= f.desde && (!f.hasta || ym <= f.hasta)) gasto(f, montoFijoPesos(f, ym));
  });
  return { por:por, comp:comp, nComp:nComp };
}
/* v237: la tarjeta para elegir cómo se reparte lo que es a medias. */
var REP_COLORES = ['#3E82D0', '#E0913A', '#2AA893', '#C2569B', '#7A68D6', '#C9A227', '#D9534F', '#4BA3A8', '#8A6A2F', '#6C7A89', '#A4C639', '#E07AA8'];
function repColor(i){ return REP_COLORES[i % REP_COLORES.length]; }
/* Lo que se ve en la barra: la parte de cada uno de un gasto entre todos. */
function repPctVista(){
  var ps = personasActivas(), modo = repModo();
  if(modo === 'mano') return repPctActivos();
  var r = repartoInfo(ps.map(function(p){ return p.id; }), mes);
  return repEnteros(ps.map(function(p){ return p.id; }), ps.map(function(p){ return (r.por[p.id] || 0) * 100; }), 100);
}
function repBarraHtml(pct){
  var ps = personasActivas();
  return '<div class="alloc rep-barra" id="repBarra" role="img" aria-label="Cómo se reparte: ' + esc(ps.map(function(p){ return p.n + ' ' + pct[p.id] + '%'; }).join(', ')) + '">'
    + ps.map(function(p, i){ return '<span data-repseg="' + esc(p.id) + '" style="flex:' + (pct[p.id] || 0) + ' 1 0;background:' + repColor(i) + '"></span>'; }).join('') + '</div>';
}
function repartoCardHtml(){
  var modo = repModo(), ps = personasActivas(), pct = repPctVista(), n = ps.length;
  var html = '<div class="card" style="margin-bottom:14px" id="cardReparto"><div class="card-head"><div><h2>Cómo se reparten los gastos a medias</h2>'
    + '<p class="sub">Vale para todo el grupo y les llega a todos.</p></div></div>'
    + '<div class="seg rep-seg" id="segReparto" role="group" aria-label="Cómo se reparte">'
    + [['partes', 'Partes iguales'], ['ingresos', 'Por sueldo'], ['mano', 'A mano']].map(function(o){
        return '<button type="button" data-rep="' + o[0] + '" aria-pressed="' + (modo === o[0] ? 'true' : 'false') + '">' + o[1] + '</button>'; }).join('')
    + '</div>'
    + repBarraHtml(pct)
    + '<div class="alloc-leg" id="repLeg">' + ps.map(function(p, i){
        return '<span><i style="background:' + repColor(i) + '"></i>' + esc(p.n) + ' <b data-repleg="' + esc(p.id) + '">' + pct[p.id] + '%</b></span>'; }).join('') + '</div>';
  if(modo === 'mano'){
    html += '<div class="rep-filas">' + ps.map(function(p, i){
        return '<div class="rep-fila"><span class="rep-nom"><i style="background:' + repColor(i) + '"></i>' + esc(p.n) + '</span>'
          + '<input class="slider rep-sl" type="range" min="0" max="100" step="1" value="' + pct[p.id] + '" data-repsl="' + esc(p.id) + '" aria-label="Porcentaje de ' + esc(p.n) + '" style="--rc:' + repColor(i) + '">'
          + '<span class="pctin rep-in"><input type="text" inputmode="numeric" maxlength="3" value="' + pct[p.id] + '" data-repin="' + esc(p.id) + '" aria-label="Porcentaje de ' + esc(p.n) + '" autocomplete="off"><i>%</i></span></div>';
      }).join('') + '</div>'
      + '<p class="note" style="margin:10px 0 0">Si a alguien le bajás el porcentaje, a los demás les sube lo mismo, repartido entre ellos, para que siempre sume 100%. '
      + '<button type="button" class="linkbtn" data-rep="iguales">Volver a partes iguales</button></p>';
  } else if(modo === 'ingresos'){
    var falta = ps.filter(function(p){ return !(ingresoRef(p.id, mes).v > 0); });
    html += '<p class="note" style="margin:10px 0 0">Cada uno pone según su sueldo de ese mes (sólo cuenta lo que entra en la categoría Sueldo): si uno cobra el 60% de los sueldos de todos, paga el 60%.'
      + (falta.length ? ' Todavía no hay sueldo cargado de ' + esc(listaY(falta.map(function(p){ return p.n; }))) + ', así que por ahora va en partes iguales.' : '') + '</p>';
  } else {
    html += '<p class="note" style="margin:10px 0 0">' + (n === 2 ? 'Mitad y mitad: 50% cada uno.' : 'Cada uno pone lo mismo: ' + esc(fmtRepPct(100 / n)) + ' cada uno.') + '</p>';
  }
  return html + '</div>';
}
function fmtRepPct(v){ return (Math.round(v * 10) / 10).toString().replace('.', ',') + '%'; }
/* Mover a uno: queda en `v` y los demás se acomodan, cada uno en proporción a lo
   que tenía, para que siga sumando 100. */
function repAjustar(id, v){
  var ps = personasActivas(), ids = ps.map(function(p){ return p.id; }); if(ids.indexOf(id) < 0) return;
  v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  var cur = repPctActivos(), otros = ids.filter(function(x){ return x !== id; });
  var resto = 100 - v, so = otros.reduce(function(a, x){ return a + (cur[x] || 0); }, 0);
  var vals = otros.map(function(x){ return so > 0 ? (cur[x] || 0) * resto / so : resto / otros.length; });
  var nuevos = repEnteros(otros, vals, resto);
  var pct = {}; pct[id] = v; otros.forEach(function(x){ pct[x] = nuevos[x]; });
  S.reparto = { modo:'mano', pct:pct };
  _repCache = null;
}
/* Mientras arrastrás, se mueve todo en el lugar (sin volver a dibujar la tarjeta). */
function repPintarVivo(){
  var pct = repPctActivos();
  Object.keys(pct).forEach(function(id){
    var sel = '[data-repsl="' + id + '"]', sl = document.querySelector(sel), inp = document.querySelector('[data-repin="' + id + '"]');
    var seg = document.querySelector('[data-repseg="' + id + '"]'), lg = document.querySelector('[data-repleg="' + id + '"]');
    if(sl && document.activeElement !== sl) sl.value = pct[id]; else if(sl && Number(sl.value) !== pct[id]) sl.value = pct[id];
    if(inp && document.activeElement !== inp) inp.value = pct[id];
    if(seg) seg.style.flex = pct[id] + ' 1 0';
    if(lg) lg.textContent = pct[id] + '%';
  });
}
document.addEventListener('input', function(e){
  var t = e.target; if(!t || !t.getAttribute) return;
  var id = t.getAttribute('data-repsl');
  if(id){ repAjustar(id, t.value); repPintarVivo(); }
});
document.addEventListener('change', function(e){
  var t = e.target; if(!t || !t.getAttribute) return;
  var id = t.getAttribute('data-repsl') || t.getAttribute('data-repin');
  if(!id) return;
  repAjustar(id, String(t.value).replace(/[^\d]/g, ''));
  save(); render();
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Enter' && e.target && e.target.getAttribute && e.target.getAttribute('data-repin')){ e.preventDefault(); e.target.blur(); }
});
document.addEventListener('click', function(e){
  var b = e.target.closest ? e.target.closest('[data-rep]') : null; if(!b) return;
  var q = b.getAttribute('data-rep');
  if(q === 'iguales'){
    var ids = personasActivas().map(function(p){ return p.id; });
    S.reparto = { modo:'mano', pct:repEnteros(ids, ids.map(function(){ return 100 / ids.length; }), 100) };
  } else {
    if(q === repModo()) return;
    // al pasar a mano, arranca desde lo que se estaba usando
    var antes = repPctVista();
    S.reparto = { modo:q, pct:(q === 'mano' ? (Object.keys((S.reparto || {}).pct || {}).length ? S.reparto.pct : antes) : ((S.reparto || {}).pct || {})) };
  }
  _repCache = null;
  save(); render();
});
function fmCodigoLindo(c){ return c ? c.slice(0, 4) + '-' + c.slice(4) : ''; }
function familiaHtml(){
  var html = '<div class="card" style="margin-bottom:14px"><div class="card-head"><div><h2>Grupo familiar</h2>'
    + '<p class="sub">La app de a varios, cada uno con su cuenta. Lo que carga cada uno les aparece a todos con su nombre, y los gastos a medias se reparten como elijan.</p></div>'
    + '<button class="btn ghost sm" data-volver type="button">Volver</button></div>';
  if(!dbActiva()) return html + '<p class="note">Para armar un grupo hace falta entrar con una cuenta.</p></div>';
  var yo = miPersona(), soyCreador = (dbSes.creador === dbSes.usuario);
  if(!yo && personasActivas().length){
    // hay gente cargada (vino con una copia importada) pero esta cuenta todavía no dijo quién es
    html += '<div class="lab">¿Quién sos?</div><div>' + personasActivas().map(function(p){
        return '<div class="fm-per"><span><b>' + esc(p.n) + '</b></span>'
          + '<button type="button" class="btn ghost sm" data-fm="soy" data-id="' + esc(p.id) + '">Soy yo</button><small></small></div>';
      }).join('') + '</div>'
      + '<p class="note" style="margin-top:8px">Estos nombres vinieron con los datos que importaste. Elegí cuál sos vos y después invitá a los demás con un código.</p>';
    return html + '</div>';
  }
  if(!yo){
    html += '<div class="fm-inv"><div class="field"><label class="lab" for="fmYo">Tu nombre</label>'
      + '<input id="fmYo" type="text" maxlength="28" placeholder="Como te dicen" autocomplete="off"></div>'
      + '<button class="btn" type="button" data-fm="crear">Armar el grupo</button></div>'
      + '<p class="note" style="margin-top:8px">Después les pasás un código a los demás, y cada uno se suma desde su cuenta. Lo que ya tenés cargado queda a tu nombre.</p>'
      + '<details class="vj-pegar"><summary>¿Te invitaron? Poné el código acá</summary>'
      + '<div class="fm-inv fm-sumar" style="margin-top:4px"><div class="field"><label class="lab" for="fmCodigoIn">Código del grupo</label>'
      + '<input id="fmCodigoIn" type="text" maxlength="12" placeholder="ABCD-1234" autocomplete="off" autocapitalize="characters" spellcheck="false"></div>'
      + '<div class="field"><label class="lab" for="fmNomIn">Tu nombre</label>'
      + '<input id="fmNomIn" type="text" maxlength="28" placeholder="Como te dicen" autocomplete="off"></div></div>'
      + '<div class="fm-trae"><div class="lab">Lo que ya tenés cargado</div>'
      + '<div class="seg" id="segTrae" role="group" aria-label="Lo que ya tenés cargado">'
      + [['todo', 'Se suma al grupo'], ['cero', 'Arranco de cero']].map(function(o){
          return '<button type="button" data-fm="trae" data-v="' + o[0] + '" aria-pressed="' + (fmTrae === o[0] ? 'true' : 'false') + '">' + o[1] + '</button>'; }).join('')
      + '</div><p class="note" id="fmTraeNota">' + fmTraeTxt() + '</p></div>'
      + '<div class="rowflex" style="margin-top:8px"><button class="btn" type="button" data-fm="usar">Sumarme al grupo</button></div></details>';
    return html + '</div>';
  }
  var e = dbEstadoTxt();
  html += '<p class="vj-auto ' + e[0] + '" id="fmAuto" role="status"><i aria-hidden="true"></i><span>' + esc(e[1]) + '</span></p>';
  html += '<div class="lab">En el grupo</div><div>' + personasActivas().map(function(p){
      var ing = ingresoRef(p.id, mes), soy = p.id === yo, conf = fmConf === 'sacar:' + p.id;
      return '<div class="fm-per"><span><b>' + esc(p.n) + '</b>' + (soy ? '<i>vos</i>' : '') + '</span>'
        + (soy || conf || !soyCreador ? '<span></span>' : '<button type="button" class="btn ghost sm peligro" data-fm="sacar" data-id="' + esc(p.id) + '">Sacar del grupo</button>')
        + '<small>' + (ing.v > 0 ? 'ingresos de ' + ymLabel(ing.ym, true) + ': ' + money(ing.v) : 'todavía no cargó ingresos') + '</small>'
        + (conf ? sacarPreguntaHtml(p) : '') + '</div>';
    }).join('') + '</div>';
  if(soyCreador){
    html += dbSes.codigo
      ? '<div class="dv-caja" id="fmInvita"><p class="note">Para sumar a alguien, pasale este código. En su app: Herramientas › Grupo familiar › "¿Te invitaron?".</p>'
        + '<p class="dv-verif" id="fmCodigo">' + esc(fmCodigoLindo(dbSes.codigo)) + '</p>'
        + '<div class="rowflex"><button class="btn ghost sm" type="button" data-fm="copiar">Copiar el código</button>'
        + '<button class="btn ghost sm" type="button" data-fm="codigoNuevo">Cambiar el código</button></div>'
        + '<p class="note" style="margin:10px 0 0">El código sirve hasta que lo cambies. Quien lo tenga y tenga cuenta puede sumarse.</p></div>'
      : '<div class="rowflex" style="margin-top:12px"><button class="btn" type="button" data-fm="codigoNuevo">Generar un código para invitar</button></div>';
  } else {
    html += '<p class="note" style="margin:12px 0 8px">Sólo quien armó el grupo puede invitar o sacar gente.</p>'
      + '<div class="rowflex"><button class="btn ghost sm peligro" type="button" data-fm="salir">'
      + (fmConf === 'salir' ? 'Tocá otra vez: salís del grupo' : 'Salir del grupo') + '</button></div>'
      + (fmConf === 'salir' ? '<p class="note" style="margin:8px 0 0">Volvés a tus datos de antes. Lo que cargaste en el grupo queda ahí, con tu nombre.</p>' : '');
  }
  html += '<details class="vj-pegar"><summary>Cambiar tu nombre</summary><div class="fm-inv" style="margin-top:4px">'
    + '<div class="field"><label class="lab" for="fmMiNom">Tu nombre</label><input id="fmMiNom" type="text" maxlength="28" value="' + esc(nombrePersona(yo)) + '" autocomplete="off"></div>'
    + '<button class="btn ghost" type="button" data-fm="minom">Guardar</button></div></details>';
  html += '</div>';
  if(personasActivas().length >= 2) html += repartoCardHtml();
  if(personasActivas().length >= 2){
    var r = repartoMes(mes), ps = personasActivas();
    html += '<div class="card" style="margin-bottom:14px"><div class="card-head"><div><h2>' + esc(ymLabel(mes).replace(/^./, function(c){ return c.toUpperCase(); })) + '</h2>'
      + '<p class="sub">' + (r.nComp ? 'Gastos a medias: ' + money(r.comp) + ' en ' + r.nComp + (r.nComp === 1 ? ' gasto' : ' gastos') : 'Todavía no hay gastos a medias este mes') + '</p></div></div>'
      + '<div class="fm-rep">' + ps.map(function(p){
          var x = r.por[p.id];
          return kv(p.n + (p.id === yo ? ' (vos)' : ''), money(x.propio + x.parte), null,
            (x.parte > 0 ? money(x.parte) + ' de lo compartido' + (x.propio > 0 ? ' + ' + money(x.propio) + ' propios' : '') : (x.propio > 0 ? money(x.propio) + ' en gastos propios' : 'Sin gastos'))
            + (x.ing.v > 0 ? ' · ganó ' + money(x.ing.v) + (x.ing.ym !== mes ? ' (en ' + ymLabel(x.ing.ym, true) + ')' : '') : ''));
        }).join('') + '</div>'
      + '<p class="note" style="margin-top:10px">' + (repModo() === 'ingresos' ? 'Cada gasto a medias se reparte según el sueldo de cada uno ese mes (lo que entra en la categoría Sueldo). Si alguno todavía no cargó su sueldo, va en partes iguales.'
            : repModo() === 'mano' ? 'Cada gasto a medias se reparte con los porcentajes que eligieron arriba.' : 'Cada gasto a medias se reparte en partes iguales.')
      + ' En Resumen y Movimientos elegís arriba ver "Todos" o lo de cada uno.</p></div>';
  } else {
    html += '<div class="card"><div class="card-head"><div><h2>Cómo funciona</h2></div></div>'
      + '<p class="note" style="margin:0 0 6px">· Cada uno carga desde su celular: gastos, ingresos, cuotas, fijos y suscripciones. Todos ven todo, con el nombre de quien lo cargó.</p>'
      + '<p class="note" style="margin:0 0 6px">· Al cargar un gasto, un fijo o una compra en cuotas, lo marcás "A medias" y elegís con quién. De entrada va en partes iguales; también puede ir según el sueldo de cada uno (si vos cobrás el 60% de los sueldos de los dos, te toca el 60%) o con un porcentaje a mano para cada uno.</p>'
      + '<p class="note" style="margin:0">· Arriba de Resumen y Movimientos elegís ver lo de todos o lo de cada uno. Las categorías, los medios de pago, las metas y los topes son de todo el grupo.</p></div>';
  }
  return html;
}
function renderFamilia(){
  var el = $('#familiaCuerpo'); if(!el) return;
  // lo que estabas escribiendo no se pierde si llega algo de otro dispositivo
  var guardo = {}, a = document.activeElement, foco = (a && a.id && el.contains(a)) ? a.id : '';
  ['fmYo', 'fmNomIn', 'fmCodigoIn', 'fmMiNom'].forEach(function(id){ var i = document.getElementById(id); if(i) guardo[id] = i.value; });
  var abierto = $$('#familiaCuerpo details[open] summary').map(function(s){ return s.textContent; });
  el.innerHTML = familiaHtml();
  Object.keys(guardo).forEach(function(id){ var i = document.getElementById(id); if(i) i.value = guardo[id]; });
  $$('#familiaCuerpo details summary').forEach(function(s){ if(abierto.indexOf(s.textContent) > -1) s.parentNode.open = true; });
  if(foco){ var f = document.getElementById(foco); if(f) try{ f.focus({ preventScroll:true }); }catch(x){} }
}
/* Armar el grupo: quien lo arma pasa a ser la primera persona, y su espacio en la
   base pasa a ser el del grupo. Después invita a los demás con un código. */
function crearGrupo(nombre){
  if(!dbActiva()){ toast('Para armar un grupo hace falta entrar con una cuenta'); return; }
  var id = vjIdCorto(), ahora = Date.now();
  S.personas = perJuntar(S.personas || [], [{ id:id, n:nombre, c:ahora, t:ahora }]);
  save();
  dbEmpujarYa().then(function(){
    // la persona ya está en la base: ahora se anota que esa persona es este usuario
    return db.from('espacio_miembros').update({ persona_id:id }).eq('espacio_id', dbSes.espacio).eq('usuario_id', dbSes.usuario);
  }).then(function(r){
    if(r && r.error) throw r.error;
    dbSes.persona = id;
    dbSes.miembros.forEach(function(m){ if(m.usuario_id === dbSes.usuario) m.persona_id = id; });
    dbGuardarCache();
    return grupoCodigoNuevo(true);
  }).then(function(){
    save(); render(); renderFamilia();
    toast('Listo, ' + nombre + '. Ahora pasales el código a los demás');
  }).catch(function(){
    S.personas = (S.personas || []).filter(function(p){ return p.id !== id; }); save(); renderFamilia();
    toast('No pude armar el grupo. Revisá la conexión y probá de nuevo');
  });
}
/* Decir cuál de las personas ya cargadas es esta cuenta (datos importados de una copia). */
function soyPersona(id){
  if(!dbActiva() || !personaPorId(id)) return;
  dbEmpujarYa().then(function(){
    return db.from('espacio_miembros').update({ persona_id:id }).eq('espacio_id', dbSes.espacio).eq('usuario_id', dbSes.usuario);
  }).then(function(r){
    if(r && r.error) throw r.error;
    dbSes.persona = id;
    dbSes.miembros.forEach(function(m){ if(m.usuario_id === dbSes.usuario) m.persona_id = id; });
    dbGuardarCache(); render(); renderFamilia();
    toast('Listo: sos ' + nombrePersona(id));
  }).catch(function(){ toast('No pude guardarlo. Revisá la conexión y probá de nuevo'); });
}
/* El código de invitación: 8 letras y números, sin los que se confunden (0/O, 1/I). */
function grupoCodigoNuevo(callado){
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.getRandomValues(new Uint8Array(8)), cod = '';
  for(var i = 0; i < 8; i++) cod += abc[b[i] % abc.length];
  return db.from('espacios').update({ codigo:cod }).eq('id', dbSes.espacio).then(function(r){
    if(r.error) throw r.error;
    dbSes.codigo = cod;
    if(!callado){ renderFamilia(); toast('Código nuevo. El anterior ya no sirve'); }
  });
}
/* Sumarse al grupo de otro. La base valida el código y agrega al usuario
   (función unirse_a_espacio); desde ahí, este usuario lee y escribe en ese espacio. */
function grupoUnirse(codigoTxt, nombre, traer){
  var cod = String(codigoTxt || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if(cod.length < 6){ toast('Poné el código que te pasaron'); var c = $('#fmCodigoIn'); if(c) c.focus(); return; }
  if(!nombre){ toast('Poné tu nombre'); var n = $('#fmNomIn'); if(n) n.focus(); return; }
  if(dbSes.codigo === cod){ toast('Ese es el código de tu propio grupo'); return; }
  var mio = traer ? JSON.parse(JSON.stringify(sinSy())) : null, per = vjIdCorto();
  toast('Sumándote al grupo…');
  dbEmpujarYa().catch(function(){}).then(function(){
    return db.rpc('unirse_a_espacio', { p_codigo:cod, p_persona:per, p_nombre:nombre });
  }).then(function(r){
    if(r.error) throw r.error;
    dbOlvidarLocal(); dbSes.espacio = '';              // desde acá, los datos son los del grupo
    return dbTraer();
  }).then(function(){
    if(mio) grupoSumarLoMio(mio, per);
    save(); fillSelects(); render(); renderFamilia();
    setTimeout(dbAvisar, 1500);                        // que los demás vean que llegó alguien
    toast('Listo, ' + nombre + ': ya estás en el grupo' + (mio ? '. Lo que tenías cargado se sumó con tu nombre' : ''));
  }).catch(function(e){
    var t = String((e && e.message) || '');
    toast(/codigo_invalido/.test(t) ? 'Ese código no existe. Fijate que esté bien escrito'
        : /grupo_lleno/.test(t) ? 'Ese grupo ya está completo'
        : 'No pude sumarte al grupo. Revisá la conexión y probá de nuevo');
  });
}
/* Lo que el que se suma tenía cargado antes pasa al grupo, a su nombre. */
function grupoSumarLoMio(mio, per){
  function mia(x){
    if(!x.quien || !personaPorId(x.quien)) x.quien = per;
    // si era "a medias" con gente de otro grupo, ese reparto acá no vale
    if(Array.isArray(x.med)){ delete x.med; delete x.medDesde; delete x.rep; delete x.pend; delete x.pendDesde; delete x.sal; }
    delete x.por;
    return x;
  }
  function sumar(dest, lista, cada){
    var ya = {}; dest.forEach(function(x){ ya[x.id] = 1; });
    (lista || []).forEach(function(x){ if(x && x.id && !ya[x.id]){ ya[x.id] = 1; dest.push(cada ? cada(x) : x); } });
  }
  S.fijos = S.fijos || []; S.pases = S.pases || []; S.hx = S.hx || []; S.viajes = S.viajes || [];
  sumar(S.tx, mio.tx, mia); sumar(S.planes, mio.planes, mia); sumar(S.fijos, mio.fijos, mia);
  sumar(S.pases, mio.pases, mia); sumar(S.hx, mio.hx, mia); sumar(S.viajes, mio.viajes);
  sumar(S.metas, mio.metas, function(m){ (m.aportes || []).forEach(mia); return m; });
  (mio.medios || []).forEach(function(m){ if(S.medios.indexOf(m) < 0) S.medios.push(m); });
  (mio.catGasto || []).forEach(function(c){ if(S.catGasto.indexOf(c) < 0) S.catGasto.push(c); });
  (mio.catIng || []).forEach(function(c){ if(S.catIng.indexOf(c) < 0) S.catIng.push(c); });
  (mio.cuentas || []).forEach(function(c){
    if(c && c.medio && !S.cuentas.some(function(x){ return x.id === c.id || x.medio === c.medio; })) S.cuentas.push(c);
  });
  Object.keys(mio.diaMedio || {}).forEach(function(k){ S.diaMedio = S.diaMedio || {}; if(!S.diaMedio[k]) S.diaMedio[k] = mio.diaMedio[k]; });
  _repCache = null;
}
/* Salir del grupo: la base saca al usuario y lo devuelve a su espacio propio. */
function grupoSalir(){
  dbEmpujarYa().catch(function(){}).then(function(){ return db.rpc('salir_del_espacio'); })
    .then(function(r){
      if(r.error) throw r.error;
      dbAvisar();
      dbOlvidarLocal(); dbSes.espacio = '';
      verQuien = ''; try{ localStorage.setItem(VER_KEY, ''); }catch(x){}
      return dbTraer();
    }).then(function(){ fillSelects(); render(); renderFamilia(); toast('Saliste del grupo. Volviste a tus datos de antes'); })
    .catch(function(){ toast('No pude sacarte del grupo. Revisá la conexión y probá de nuevo'); });
}
/* v239: al sacar a alguien, se pregunta qué hacer con lo que cargó. */
var fmBorrarArmado = '';
/* v240: al invitar, si lo que el otro ya tenía cargado se suma al grupo o no */
var fmTrae = 'todo';
function fmTraeTxt(){
  return fmTrae === 'cero'
    ? 'Al grupo entra sólo lo que cargues desde ahora. Lo de antes queda guardado en tu cuenta y lo volvés a ver si salís del grupo.'
    : 'Tus movimientos, cuotas y ahorros de antes se suman al grupo con tu nombre.';
}
function cargadoPor(id){
  var c = { tx:0, gas:0, ing:0, planes:0, fijos:0, pases:0, hx:0, aportes:0, medias:0 };
  S.tx.forEach(function(t){ if(quienDe(t) === id){ c.tx++; if(t.tipo === 'ingreso') c.ing++; else c.gas++; } else if(Array.isArray(t.med) && t.med.indexOf(id) > -1) c.medias++; });
  S.planes.forEach(function(x){ if(quienDe(x) === id) c.planes++; else if(Array.isArray(x.med) && x.med.indexOf(id) > -1) c.medias++; });
  (S.fijos || []).forEach(function(x){ if(quienDe(x) === id) c.fijos++; else if(Array.isArray(x.med) && x.med.indexOf(id) > -1) c.medias++; });
  (S.pases || []).forEach(function(x){ if(quienDe(x) === id) c.pases++; });
  (S.hx || []).forEach(function(x){ if(quienDe(x) === id) c.hx++; });
  S.metas.forEach(function(m){ (m.aportes || []).forEach(function(a){ if(quienDe(a) === id) c.aportes++; }); });
  c.total = c.tx + c.planes + c.fijos + c.pases + c.hx + c.aportes;
  return c;
}
function cuantosTxt(c){
  var l = [];
  function n(k, uno, varios){ if(k) l.push(k + ' ' + (k === 1 ? uno : varios)); }
  n(c.gas, 'gasto', 'gastos'); n(c.ing, 'ingreso', 'ingresos'); n(c.planes, 'compra en cuotas', 'compras en cuotas');
  n(c.fijos, 'fijo', 'fijos'); n(c.pases, 'pase', 'pases'); n(c.aportes, 'aporte a una meta', 'aportes a metas'); n(c.hx, 'carga de horas extras', 'cargas de horas extras');
  return listaY(l);
}
function sacarPreguntaHtml(p){
  var c = cargadoPor(p.id), armado = fmBorrarArmado === p.id;
  return '<div class="dv-caja dv-preg fm-sacar" id="fmSacar">'
    + '<p><b>¿Sacar a ' + esc(p.n) + ' del grupo?</b></p>'
    + '<p class="note">Deja de ver lo del grupo y vuelve a sus propios datos.'
    + (c.total ? ' Cargó ' + esc(cuantosTxt(c)) + '. ¿Qué hacemos con eso?' : ' No cargó nada todavía.') + '</p>'
    + '<div class="rowflex">'
    + (c.total
        ? '<button class="btn" type="button" data-fm="sacarDejar" data-id="' + esc(p.id) + '">Sacar y dejar lo que cargó</button>'
          + '<button class="btn ghost" type="button" data-fm="sacarBorrar" data-id="' + esc(p.id) + '" style="color:var(--out);border-color:var(--out)">'
          + (armado ? 'Tocá otra vez: se borra todo lo suyo' : 'Sacar y borrar lo que cargó') + '</button>'
        : '<button class="btn" type="button" data-fm="sacarDejar" data-id="' + esc(p.id) + '">Sacar del grupo</button>')
    + '<button class="btn ghost" type="button" data-fm="sacarNo">Cancelar</button></div>'
    + (c.total ? '<p class="note" style="margin:8px 0 0">Si lo dejás, queda como historia del grupo, con su nombre. Si lo borrás, se borra para todos'
        + (c.medias ? '; y de los gastos a medias de los demás que lo incluían, sale del reparto' : '') + '.</p>' : '')
    + '</div>';
}
/* Borra lo que cargó esa persona (en este dispositivo; la sincronización lo
   borra en los demás) y la saca de los repartos a medias de los otros. */
function borrarLoDe(id){
  var de = function(x){ return quienDe(x) === id; };
  function sinEl(x){
    if(!Array.isArray(x.med) || x.med.indexOf(id) < 0) return;
    var m = x.med.filter(function(q){ return q !== id; });
    if(m.length > 1) x.med = m; else { delete x.med; delete x.medDesde; }
  }
  S.tx = S.tx.filter(function(x){ return !de(x); }); S.tx.forEach(sinEl);
  S.planes = S.planes.filter(function(x){ return !de(x); }); S.planes.forEach(sinEl);
  S.fijos = (S.fijos || []).filter(function(x){ return !de(x); }); S.fijos.forEach(sinEl);
  S.pases = (S.pases || []).filter(function(x){ return !de(x); });
  S.hx = (S.hx || []).filter(function(x){ return !de(x); });
  S.metas.forEach(function(m){ m.aportes = (m.aportes || []).filter(function(a){ return !de(a); }); });
  if(S.reparto && S.reparto.pct && (id in S.reparto.pct)){ delete S.reparto.pct[id]; }
  _repCache = null;
}
/* Sacar a alguien: deja de ser miembro del espacio (ya no puede leer ni escribir
   ahí). Lo que cargó queda, con su nombre, salvo que elijas borrarlo (v239). */
function sacarPersona(id){
  var p = personaPorId(id); if(!p || id === miPersona()) return;
  p.fuera = 1; p.t = Date.now();
  if(verQuien === id){ verQuien = ''; try{ localStorage.setItem(VER_KEY, ''); }catch(x){} }
  save(); render();
  if(!dbActiva()) return;
  var m = dbSes.miembros.filter(function(x){ return x.persona_id === id; })[0];
  if(!m) return;
  dbEmpujarYa().catch(function(){}).then(function(){
    return db.from('espacio_miembros').delete().eq('espacio_id', dbSes.espacio).eq('usuario_id', m.usuario_id);
  }).then(function(){ dbAvisar(); dbTraerPronto(); }).catch(function(){});
}
function renombrarPersona(id, nombre){
  var p = personaPorId(id); if(!p) return;
  p.n = nombre; p.t = Date.now();
  save(); render();
  toast('Ahora sos ' + nombre + ' para el grupo');
}
document.addEventListener('click', function(e){
  if(!e.target.closest) return;
  var t = e.target.closest('[data-ver]');
  if(t){
    verQuien = t.getAttribute('data-ver') || '';
    try{ localStorage.setItem(VER_KEY, verQuien); }catch(x){}
    render(); pintarLupa(); pintarMedios(); return;
  }
  if((t = e.target.closest('[data-medsw]'))){
    var pref = t.getAttribute('data-medsw'), on = t.getAttribute('aria-checked') !== 'true';
    t.setAttribute('aria-checked', on ? 'true' : 'false');
    var ch = t.parentNode.querySelector('[data-medchips]'); if(ch) ch.hidden = !on;
    pintarPistaMed(pref); return;
  }
  if((t = e.target.closest('[data-repm]'))){
    var qbr = t.closest('[data-qb]'); if(!qbr) return;
    var prf = qbr.getAttribute('data-qb'), bx = $(QB[prf]), m = t.getAttribute('data-repm');
    bx.setAttribute('data-repmodo', m);
    bx.setAttribute('data-reppropia', m !== repModo() ? '1' : '');
    bx._repPct = null;
    var mn2 = bx.querySelector('[data-repmano]'); if(mn2) mn2.removeAttribute('data-ids');
    pintarPistaMed(prf); return;
  }
  if((t = e.target.closest('[data-repgrupo]'))){
    var pg = t.getAttribute('data-repgrupo'), bg = $(QB[pg]);
    bg.setAttribute('data-repmodo', repModo()); bg.setAttribute('data-reppropia', ''); bg._repPct = null;
    var mn3 = bg.querySelector('[data-repmano]'); if(mn3) mn3.removeAttribute('data-ids');
    pintarPistaMed(pg); return;
  }
  if((t = e.target.closest('[data-medp]'))){
    t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    var qb = t.closest('[data-qb]'); if(qb) pintarPistaMed(qb.getAttribute('data-qb'));
    return;
  }
  if(e.target.closest('#fManual')){ fManual = !fManual; pintarFManual(); return; }
  if((t = e.target.closest('[data-fman]'))){
    var fm = null; (S.fijos || []).forEach(function(f){ if(f.id === t.getAttribute('data-fman')) fm = f; });
    if(!fm) return;
    // desde este mes: los que ya pasaron quedan como estaban
    if(fm.man) delete fm.man; else fm.man = ymNow() < fm.desde ? fm.desde : ymNow();
    save(); render();
    toast(fm.man ? fm.nombre + ': desde ' + ymLabel(fm.man) + ' se cuenta cuando lo tachás en ' + (fm.tipo === 'ingreso' ? 'Cobros' : 'Pagos') + ' del mes'
                 : fm.nombre + ': vuelve a sumarse solo el día que ' + (fm.tipo === 'ingreso' ? 'entra' : 'vence'));
    return;
  }
  if((t = e.target.closest('[data-fmed]'))){
    var fx = null; (S.fijos || []).forEach(function(f){ if(f.id === t.getAttribute('data-fmed')) fx = f; });
    if(!fx) return;
    if(esMedias(fx)){ delete fx.med; delete fx.pend; delete fx.pendDesde; delete fx.sal; } else { fx.med = personasActivas().map(function(p){ return p.id; }); fx.pend = 1; fx.pendDesde = ymNow(); }
    save(); render();
    toast(fx.med ? fx.nombre + ': a medias, ' + textoReparto(fx.med, mes, montoFijoPesos(fx, mes), fx.rep) : fx.nombre + ' ya no es a medias');
    return;
  }
  var b = e.target.closest('[data-fm]');
  if(!b){ if(fmConf && !e.target.closest('#familiaCuerpo')){ fmConf = null; renderFamilia(); } return; }
  var q = b.getAttribute('data-fm'), id = b.getAttribute('data-id') || '';
  if(['sacar', 'sacarBorrar', 'sacarNo', 'sacarDejar', 'salir'].indexOf(q) < 0){ fmConf = null; fmBorrarArmado = ''; }
  if(q === 'crear'){
    var n = (($('#fmYo') || {}).value || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    if(!n){ toast('Poné tu nombre'); var fy = $('#fmYo'); if(fy) fy.focus(); return; }
    crearGrupo(n); return;
  }
  if(q === 'usar'){
    grupoUnirse(($('#fmCodigoIn') || {}).value || '', (($('#fmNomIn') || {}).value || '').trim().replace(/\s+/g, ' ').slice(0, 28), fmTrae !== 'cero');
    return;
  }
  if(q === 'soy'){ soyPersona(id); return; }
  if(q === 'copiar'){
    var cod = fmCodigoLindo(dbSes.codigo);
    try{ navigator.clipboard.writeText(cod).then(function(){ toast('Código copiado: ' + cod); }, function(){ toast('El código es ' + cod); }); }
    catch(x){ toast('El código es ' + cod); }
    return;
  }
  if(q === 'codigoNuevo'){ grupoCodigoNuevo(false).catch(function(){ toast('No pude generar el código. Revisá la conexión'); }); return; }
  if(q === 'salir'){
    if(fmConf !== 'salir'){ fmConf = 'salir'; renderFamilia(); return; }
    fmConf = null; grupoSalir(); return;
  }
  if(q === 'trae'){
    // sin redibujar: así no se borra el nombre que ya escribiste
    fmTrae = b.getAttribute('data-v') === 'cero' ? 'cero' : 'todo';
    $$('#segTrae [data-v]').forEach(function(x){ x.setAttribute('aria-pressed', x.getAttribute('data-v') === fmTrae ? 'true' : 'false'); });
    var tn = $('#fmTraeNota'); if(tn) tn.textContent = fmTraeTxt();
    return;
  }
  if(q === 'sacar'){ fmConf = 'sacar:' + id; fmBorrarArmado = ''; renderFamilia(); return; }
  if(q === 'sacarNo'){ fmConf = null; fmBorrarArmado = ''; renderFamilia(); return; }
  if(q === 'sacarDejar'){
    var nd = nombrePersona(id); fmConf = null; fmBorrarArmado = '';
    sacarPersona(id); setTimeout(function(){ toast(nd + ' ya no está en el grupo. Lo que cargó queda con su nombre'); }, 2600); return;
  }
  if(q === 'sacarBorrar'){
    if(fmBorrarArmado !== id){ fmConf = 'sacar:' + id; fmBorrarArmado = id; renderFamilia(); return; }
    var nb = nombrePersona(id), cb = cargadoPor(id).total; fmConf = null; fmBorrarArmado = '';
    borrarLoDe(id); sacarPersona(id); render();
    setTimeout(function(){ toast(nb + ' ya no está en el grupo. Se ' + (cb === 1 ? 'borró 1 cosa que había cargado' : 'borraron las ' + cb + ' cosas que había cargado')); }, 2600);
    return;
  }
  if(q === 'minom'){
    var nn = (($('#fmMiNom') || {}).value || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    if(!nn){ toast('El nombre no puede quedar vacío'); return; }
    renombrarPersona(miPersona(), nn); return;
  }
});
/* La pista del reparto se actualiza mientras escribís el monto o cambiás la fecha. */
['input', 'change'].forEach(function(ev){
  document.addEventListener(ev, function(e){
    var f = e.target.closest ? e.target.closest('#fMov, #fCuota, #fFijo') : null;
    if(!f) return;
    // v282: tocar un porcentaje a mano lo vuelve propio de este gasto
    if(e.target.hasAttribute && e.target.hasAttribute('data-reppct')){
      var qbx = e.target.closest('[data-qb]'), bxx = qbx && $(QB[qbx.getAttribute('data-qb')]);
      if(bxx){ bxx.setAttribute('data-reppropia', '1'); bxx._repPct = repLeerMano(bxx); }
    }
    pintarPistaMed(f.id === 'fMov' ? 'm' : f.id === 'fCuota' ? 'q' : 'f');
  });
});
